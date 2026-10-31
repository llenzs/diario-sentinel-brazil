import { adminClient, getEnabledIntegration } from "../_shared/supabase.ts";
import { jsonResponse, sha256Hex } from "../_shared/invoke.ts";

/**
 * INLabs adapter for DOU.
 * Authenticates against inlabs.in.gov.br, downloads the daily ZIP of XMLs,
 * parses each section's content, upserts into publications, then dispatches
 * match-extractor per new publication.
 */
Deno.serve(async (req) => {
  let payload: { source_id?: string; source_code?: string; date?: string } = {};
  try {
    payload = await req.json();
  } catch {
    // ignore
  }
  const { source_id, source_code, date } = payload;
  if (!source_id || !date) {
    return jsonResponse({ error: "source_id and date required" }, 400);
  }

  const supa = adminClient();
  await markRun(supa, source_id, date, "running");

  // DOU não publica em sábado/domingo. Antecipa skip pra evitar gastar
  // tempo + memória baixando ZIP inexistente.
  const dow = new Date(date + "T12:00:00Z").getUTCDay(); // 0=Dom, 6=Sáb
  if (dow === 0 || dow === 6) {
    await markRun(supa, source_id, date, "success", null, 0);
    return jsonResponse({
      source_code,
      inserted: 0,
      pages: 0,
      note: `DOU não publica em ${dow === 0 ? "domingo" : "sábado"}`,
    });
  }

  try {
    const inlabs = await getEnabledIntegration("inlabs");
    const email = (inlabs.config as { email?: string }).email;
    const password = inlabs.secrets.password;
    if (!email || !password) {
      throw new Error("inlabs config incompleto: email (config) + password (vault) obrigatórios");
    }

    // 1) Authenticate via raw HTTPS to capture Set-Cookie (fetch API hides
    //    headers on opaqueredirect / cross-redirect cookie semantics).
    const sessionCookie = await loginInlabs(email, password);
    if (!sessionCookie) {
      throw new Error("INLabs auth failed: cookie de sessão ausente");
    }

    // 2) Download daily archives — DOU has sections DO1, DO2, DO3 (caps!)
    // Pattern real do INLabs: /index.php?p=YYYY-MM-DD&dl=YYYY-MM-DD-DO1.zip
    // INLabs ZIPs são gigantes (centenas de MB). Edge functions têm limite
    // de RAM/CPU então: 1 seção por chamada, batch processing,
    // limite máximo de artigos por execução.
    // Pra processar tudo, o orchestrator pode ser chamado várias vezes ou
    // ter um cron específico que itera seções.
    //
    // Body opcional: { section: "DO1" | "DO2" | "DO3", max_items?: number }
    const section = (payload as { section?: string }).section ?? "DO1";
    const maxItems = (payload as { max_items?: number }).max_items ?? 200;
    const insertedIds: string[] = [];
    let pagesProcessed = 0;

    const url = `https://inlabs.in.gov.br/index.php?p=${date}&dl=${date}-${section}.zip`;
    const r = await fetch(url, { headers: { cookie: sessionCookie } });
    if (!r.ok) {
      await markRun(supa, source_id, date, "success", null, 0);
      return jsonResponse({
        source_code,
        inserted: 0,
        pages: 0,
        note: `INLabs sem ZIP pra ${date}/${section} (HTTP ${r.status})`,
      });
    }

    const buf = new Uint8Array(await r.arrayBuffer());
    const entries = await unzipExtract(buf);
    outer: for (const entry of entries) {
      const text = new TextDecoder("utf-8").decode(entry.data);
      const parsed = parseInlabsXml(text);
      for (const item of parsed) {
        if (pagesProcessed >= maxItems) break outer;
        const contentHash = await sha256Hex(item.raw_text);
        const { data: ins, error } = await supa
          .from("publications")
          .upsert(
            {
              source_id,
              publication_date: date,
              external_id: item.external_id ?? null,
              section,
              title: item.title ?? null,
              url: item.url ?? null,
              content_hash: contentHash,
              raw_text: item.raw_text,
            },
            { onConflict: "source_id,content_hash,publication_date", ignoreDuplicates: true },
          )
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (ins?.id) insertedIds.push(ins.id);
        pagesProcessed++;
      }
    }

    await markRun(supa, source_id, date, "success", null, pagesProcessed);

    // The publications insert trigger trg_fire_match_extractor handles match
    // extraction automatically. No server-to-server call here.

    return jsonResponse({ source_code, inserted: insertedIds.length, pages: pagesProcessed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : ((e as { message?: string })?.message ?? JSON.stringify(e));
    await markRun(supa, source_id, date, "failed", msg);
    return jsonResponse({ error: msg }, 500);
  }
});

/**
 * Faz login no INLabs via TLS cru e retorna o header `Cookie` montado
 * (inlabs_session_cookie + PHPSESSID). Necessário porque `fetch` com
 * `redirect: "manual"` retorna opaqueredirect sem expor Set-Cookie no Deno,
 * e com `redirect: "follow"` os cookies do redirect intermediário são
 * absorvidos internamente e não acessíveis ao caller.
 */
async function loginInlabs(email: string, password: string): Promise<string | null> {
  const body = new URLSearchParams({ email, password }).toString();
  const req =
    `POST /logar.php HTTP/1.1\r\n` +
    `Host: inlabs.in.gov.br\r\n` +
    `User-Agent: diario-scanner/1.0\r\n` +
    `Content-Type: application/x-www-form-urlencoded\r\n` +
    `Content-Length: ${body.length}\r\n` +
    `Accept: */*\r\n` +
    `Connection: close\r\n` +
    `\r\n` +
    body;

  const conn = await Deno.connectTls({ hostname: "inlabs.in.gov.br", port: 443 });
  try {
    await conn.write(new TextEncoder().encode(req));
    const buf = new Uint8Array(8192);
    let raw = "";
    while (true) {
      const n = await conn.read(buf);
      if (n === null) break;
      raw += new TextDecoder().decode(buf.subarray(0, n));
      // headers terminam em \r\n\r\n; body do login é vazio. Parar logo.
      if (raw.includes("\r\n\r\n") && raw.length > 200) break;
    }
    const cookies: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const m = /^Set-Cookie:\s*([^;]+)/i.exec(line);
      if (m) cookies.push(m[1].trim());
    }
    const session = cookies.find((c) => c.startsWith("inlabs_session_cookie="));
    if (!session) return null;
    return cookies.join("; ");
  } finally {
    try {
      conn.close();
    } catch {
      // ignore double-close
    }
  }
}

async function markRun(
  supa: ReturnType<typeof adminClient>,
  source_id: string,
  date: string,
  status: "running" | "success" | "failed",
  error: string | null = null,
  pages_processed = 0,
) {
  const now = new Date().toISOString();
  await supa.from("scrape_runs").upsert(
    {
      source_id,
      publication_date: date,
      status,
      error,
      pages_processed,
      started_at: status === "running" ? now : undefined,
      finished_at: status === "running" ? null : now,
    },
    { onConflict: "source_id,publication_date" },
  );
}

type ParsedItem = {
  external_id?: string;
  title?: string;
  url?: string;
  raw_text: string;
};

/**
 * Extracts <article> blocks from an INLabs section XML.
 * Each article carries: id attr, name attr, idMateria, pubName, body/Identifica, body/Titulo, body/Texto.
 */
function parseInlabsXml(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const re = /<article\b([^>]*)>([\s\S]*?)<\/article>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const body = m[2];
    const external_id = /\bid="([^"]+)"/.exec(attrs)?.[1];
    const rawUrl = /\bpdfPage="([^"]+)"/.exec(attrs)?.[1];
    const url = rawUrl ? normalizeUrl(decodeEntities(rawUrl)) : undefined;
    const title =
      decodeEntities(stripTags(/<Identifica>([\s\S]*?)<\/Identifica>/.exec(body)?.[1] ?? "")) ||
      decodeEntities(stripTags(/<Titulo>([\s\S]*?)<\/Titulo>/.exec(body)?.[1] ?? "")) ||
      undefined;
    const text = decodeEntities(stripTags(body)).replace(/\s+/g, " ").trim();
    if (text.length < 40) continue;
    items.push({ external_id, title, url, raw_text: text });
  }
  return items;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function normalizeUrl(u: string): string {
  // DOU/INLabs sempre tem versão HTTPS; força pra evitar mixed content
  return u.replace(/^http:\/\//, "https://");
}

/**
 * Tiny ZIP reader (stored entries only). INLabs ships uncompressed .zip per section
 * containing one or more .xml files. If the entry is deflated, we use DecompressionStream.
 */
type ZipEntry = { name: string; data: Uint8Array };
async function unzipExtract(buf: Uint8Array): Promise<ZipEntry[]> {
  const out: ZipEntry[] = [];
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let i = 0;
  while (i < buf.byteLength - 4) {
    const sig = dv.getUint32(i, true);
    if (sig !== 0x04034b50) break;
    const method = dv.getUint16(i + 8, true);
    const compSize = dv.getUint32(i + 18, true);
    const uncompSize = dv.getUint32(i + 22, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const nameStart = i + 30;
    const name = new TextDecoder().decode(buf.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const chunk = buf.subarray(dataStart, dataStart + compSize);
    let data: Uint8Array;
    if (method === 0) {
      data = chunk.slice();
    } else if (method === 8) {
      const ds = new DecompressionStream("deflate-raw");
      const stream = new Blob([chunk]).stream().pipeThrough(ds);
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      i = dataStart + compSize;
      continue;
    }
    if (name.toLowerCase().endsWith(".xml")) {
      out.push({ name, data: data.subarray(0, uncompSize || data.byteLength) });
    }
    i = dataStart + compSize;
  }
  return out;
}
