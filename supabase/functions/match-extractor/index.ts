// schema v2: partitioned by publication_date
import { adminClient } from "../_shared/supabase.ts";
import { jsonResponse } from "../_shared/invoke.ts";

/**
 * Receives { publication_ids: string[] } and applies all active terms
 * bound to each publication's source. Inserts matches and triggers ai-classifier.
 */
Deno.serve(async (req) => {
  let body: { publication_ids?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const ids = body.publication_ids ?? [];
  if (ids.length === 0) {
    return jsonResponse({ error: "publication_ids required" }, 400);
  }

  const supa = adminClient();
  try {
    const { data: pubs, error: pErr } = await supa
      .from("publications")
      .select("id, source_id, raw_text, publication_date")
      .in("id", ids);
    if (pErr) throw pErr;

    let inserted = 0;
    const matchIds: string[] = [];

    for (const pub of pubs ?? []) {
      const { data: termRows, error: tErr } = await supa
        .from("term_sources")
        .select("term_id, terms!inner(id, user_id, label, pattern, match_type, active)")
        .eq("source_id", pub.source_id)
        .eq("terms.active", true);
      if (tErr) throw tErr;

      const text = pub.raw_text;
      const textLower = text.toLowerCase();

      for (const row of termRows ?? []) {
        const term = (row as { terms: TermDef }).terms;
        const positions = findMatches(text, textLower, term);
        if (positions.length === 0) continue;
        const excerpt = buildExcerpt(text, positions[0], 200);

        const { error: insErr, data: ins } = await supa
          .from("matches")
          .upsert(
            {
              user_id: term.user_id,
              term_id: term.id,
              publication_id: pub.id,
              publication_date: (pub as { publication_date: string }).publication_date,
              excerpt,
            },
            { onConflict: "term_id,publication_id", ignoreDuplicates: true },
          )
          .select("id")
          .maybeSingle();
        if (insErr) throw insErr;
        if (ins?.id) {
          inserted++;
          matchIds.push(ins.id);
        }
      }
    }

    // ai-classifier is on a 2-minute cron; new matches pick up automatically.

    return jsonResponse({
      publications_processed: pubs?.length ?? 0,
      matches_inserted: inserted,
      match_ids: matchIds,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

type TermDef = {
  id: string;
  user_id: string;
  label: string;
  pattern: string;
  match_type: "literal" | "regex" | "cnpj";
  active: boolean;
};

function findMatches(text: string, textLower: string, term: TermDef): number[] {
  const positions: number[] = [];
  if (term.match_type === "literal") {
    const needle = term.pattern.toLowerCase();
    if (!needle) return positions;
    let from = 0;
    while (from < textLower.length) {
      const idx = textLower.indexOf(needle, from);
      if (idx < 0) break;
      positions.push(idx);
      from = idx + needle.length;
      if (positions.length >= 5) break;
    }
  } else if (term.match_type === "regex") {
    try {
      const re = new RegExp(term.pattern, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        positions.push(m.index);
        if (positions.length >= 5) break;
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    } catch {
      // invalid regex — skip silently
    }
  } else if (term.match_type === "cnpj") {
    const digits = term.pattern.replace(/\D/g, "");
    if (digits.length !== 14) return positions;
    const re = buildCnpjRegex(digits);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      positions.push(m.index);
      if (positions.length >= 5) break;
    }
  }
  return positions;
}

function buildCnpjRegex(digits: string): RegExp {
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 8),
    digits.slice(8, 12),
    digits.slice(12, 14),
  ];
  const pattern = parts.map((p, i) => p + (i < parts.length - 1 ? "[\\.\\-/\\s]?" : "")).join("");
  return new RegExp(pattern, "g");
}

function buildExcerpt(text: string, pos: number, radius: number): string {
  const start = Math.max(0, pos - radius);
  const end = Math.min(text.length, pos + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return (prefix + text.slice(start, end) + suffix).replace(/\s+/g, " ").trim();
}
