import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Mail, User } from "lucide-react";

type AuthSliderProps = {
  initialMode: "login" | "register";
  onLogin: (email: string, password: string) => void | Promise<void>;
  onRegister: (name: string, email: string, password: string) => void | Promise<void>;
  loading: boolean;
};

export function AuthSlider({
  initialMode,
  onLogin,
  onRegister,
  loading,
}: AuthSliderProps) {
  const [isActive, setIsActive] = useState(initialMode === "register");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  useEffect(() => {
    setIsActive(initialMode === "register");
  }, [initialMode]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onLogin(loginEmail, loginPassword);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onRegister(name, regEmail, regPassword);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <style>{css}</style>
      <div className={`as-container${isActive ? " active" : ""}`}>
        {/* Login Form */}
        <div className="as-form-box as-login">
          <form onSubmit={handleLoginSubmit}>
            <h1>Entrar</h1>
            <div className="as-input-box">
              <label htmlFor="as-login-email" className="sr-only">
                E-mail
              </label>
              <input
                id="as-login-email"
                type="email"
                placeholder="E-mail"
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                disabled={loading}
              />
              <Mail className="as-icon" aria-hidden="true" />
            </div>
            <div className="as-input-box">
              <label htmlFor="as-login-password" className="sr-only">
                Senha
              </label>
              <input
                id="as-login-password"
                type="password"
                placeholder="Senha"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                disabled={loading}
              />
              <Lock className="as-icon" aria-hidden="true" />
            </div>
            <div className="as-forgot-link">
              <Link to="/forgot-password">Esqueci minha senha</Link>
            </div>
            <button type="submit" className="as-btn" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        {/* Register Form */}
        <div className="as-form-box as-register">
          <form onSubmit={handleRegisterSubmit}>
            <h1>Criar conta</h1>
            <div className="as-input-box">
              <label htmlFor="as-reg-name" className="sr-only">
                Nome
              </label>
              <input
                id="as-reg-name"
                type="text"
                placeholder="Nome"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
              <User className="as-icon" aria-hidden="true" />
            </div>
            <div className="as-input-box">
              <label htmlFor="as-reg-email" className="sr-only">
                E-mail
              </label>
              <input
                id="as-reg-email"
                type="email"
                placeholder="E-mail"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                disabled={loading}
              />
              <Mail className="as-icon" aria-hidden="true" />
            </div>
            <div className="as-input-box">
              <label htmlFor="as-reg-password" className="sr-only">
                Senha
              </label>
              <input
                id="as-reg-password"
                type="password"
                placeholder="Senha (mín. 8 caracteres)"
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                disabled={loading}
              />
              <Lock className="as-icon" aria-hidden="true" />
            </div>
            <button type="submit" className="as-btn" disabled={loading}>
              {loading ? "Criando..." : "Criar conta"}
            </button>
          </form>
        </div>

        {/* Toggle Box */}
        <div className="as-toggle-box">
          <div className="as-toggle-panel as-toggle-left">
            <h1>Olá, bem-vindo!</h1>
            <p>Ainda não tem uma conta?</p>
            <button
              type="button"
              className="as-btn as-btn-outline"
              onClick={() => setIsActive(true)}
              disabled={loading}
            >
              Criar conta
            </button>
          </div>
          <div className="as-toggle-panel as-toggle-right">
            <h1>Bem-vindo de volta!</h1>
            <p>Já tem uma conta?</p>
            <button
              type="button"
              className="as-btn as-btn-outline"
              onClick={() => setIsActive(false)}
              disabled={loading}
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const css = `
.as-container {
  position: relative;
  width: 850px;
  max-width: 100%;
  height: 550px;
  background: hsl(var(--card, 0 0% 100%));
  background: var(--card);
  color: var(--card-foreground);
  border-radius: 30px;
  box-shadow: 0 10px 40px -10px color-mix(in oklab, var(--foreground) 20%, transparent);
  overflow: hidden;
  border: 1px solid var(--border);
}

.as-container h1 {
  font-size: 32px;
  margin: -10px 0;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--foreground);
}

.as-container p {
  font-size: 14.5px;
  margin: 15px 0;
}

.as-form-box {
  position: absolute;
  right: 0;
  width: 50%;
  height: 100%;
  background: var(--card);
  display: flex;
  align-items: center;
  text-align: center;
  padding: 40px;
  z-index: 1;
  transition: 0.6s ease-in-out 1.2s, visibility 0s 1s;
}

.as-form-box > form { width: 100%; }

.as-container.active .as-form-box.as-login {
  right: 50%;
}

.as-form-box.as-register {
  visibility: hidden;
  right: 50%;
}

.as-container.active .as-form-box.as-register {
  visibility: visible;
  right: 0;
}

.as-input-box {
  position: relative;
  margin: 28px 0;
}

.as-input-box input {
  width: 100%;
  padding: 13px 50px 13px 20px;
  background: var(--muted);
  border-radius: 8px;
  border: 1px solid transparent;
  outline: none;
  font-size: 15px;
  color: var(--foreground);
  font-weight: 500;
  font-family: inherit;
  transition: border-color 0.2s, background 0.2s;
}

.as-input-box input::placeholder {
  color: var(--muted-foreground);
  font-weight: 400;
}

.as-input-box input:focus {
  border-color: var(--ring);
  background: var(--background);
}

.as-icon {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--muted-foreground);
  pointer-events: none;
}

.as-forgot-link {
  margin: -10px 0 18px;
  text-align: right;
}

.as-forgot-link a {
  font-size: 13.5px;
  color: var(--muted-foreground);
  text-decoration: none;
}
.as-forgot-link a:hover { color: var(--foreground); text-decoration: underline; }

.as-btn {
  width: 100%;
  height: 48px;
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  transition: opacity 0.2s, transform 0.05s;
}
.as-btn:hover:not(:disabled) { opacity: 0.92; }
.as-btn:active:not(:disabled) { transform: translateY(1px); }
.as-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.as-toggle-box {
  position: absolute;
  width: 100%;
  height: 100%;
}

.as-toggle-box::before {
  content: '';
  position: absolute;
  left: -250%;
  width: 300%;
  height: 100%;
  background: var(--accent);
  border-radius: 150px;
  z-index: 2;
  transition: 1.8s ease-in-out;
}

.as-container.active .as-toggle-box::before {
  left: 50%;
}

.as-toggle-panel {
  position: absolute;
  width: 50%;
  height: 100%;
  color: var(--accent-foreground);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0 30px;
  text-align: center;
  z-index: 2;
  transition: 0.6s ease-in-out;
}

.as-toggle-panel h1 { color: var(--accent-foreground); }
.as-toggle-panel p { color: var(--accent-foreground); opacity: 0.9; margin-bottom: 20px; }

.as-toggle-panel.as-toggle-left {
  left: 0;
  transition-delay: 1.2s;
}
.as-container.active .as-toggle-panel.as-toggle-left {
  left: -50%;
  transition-delay: 0.6s;
}

.as-toggle-panel.as-toggle-right {
  right: -50%;
  transition-delay: 0.6s;
}
.as-container.active .as-toggle-panel.as-toggle-right {
  right: 0;
  transition-delay: 1.2s;
}

.as-btn-outline {
  width: 160px;
  height: 46px;
  background: transparent;
  border: 2px solid var(--accent-foreground);
  color: var(--accent-foreground);
  box-shadow: none;
}
.as-btn-outline:hover:not(:disabled) {
  background: color-mix(in oklab, var(--accent-foreground) 12%, transparent);
  opacity: 1;
}

@media screen and (max-width: 850px) {
  .as-container { width: 100%; margin: 0; }
}

@media screen and (max-width: 650px) {
  .as-container {
    height: calc(100vh - 40px);
    border-radius: 20px;
  }
  .as-form-box {
    bottom: 0;
    width: 100%;
    height: 70%;
    right: 0;
  }
  .as-container.active .as-form-box.as-login {
    right: 0;
    bottom: 30%;
  }
  .as-form-box.as-register {
    right: 0;
    bottom: -70%;
  }
  .as-container.active .as-form-box.as-register {
    right: 0;
    bottom: 30%;
  }
  .as-toggle-box::before {
    left: 0;
    top: -270%;
    width: 100%;
    height: 300%;
    border-radius: 20vw;
  }
  .as-container.active .as-toggle-box::before {
    left: 0;
    top: 70%;
  }
  .as-toggle-panel {
    width: 100%;
    height: 30%;
  }
  .as-toggle-panel.as-toggle-left { top: 0; left: 0; }
  .as-container.active .as-toggle-panel.as-toggle-left {
    left: 0;
    top: -30%;
  }
  .as-toggle-panel.as-toggle-right {
    right: 0;
    bottom: -30%;
  }
  .as-container.active .as-toggle-panel.as-toggle-right {
    bottom: 0;
  }
}

@media screen and (max-width: 400px) {
  .as-form-box { padding: 24px; }
  .as-toggle-panel h1 { font-size: 26px; }
}
`;
