import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { mensagemDeErro } from "../services/api";
import Alert from "../components/Alert";

function obterDestino(state) {
  const origem = state?.from;
  if (!origem || typeof origem.pathname !== "string" || !origem.pathname.startsWith("/"))
    return "/locacoes";
  if (origem.pathname.startsWith("//")) return "/locacoes";
  return `${origem.pathname}${origem.search || ""}${origem.hash || ""}`;
}

export default function Login() {
  const { usuario, carregando, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const destino = obterDestino(location.state);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState(
    location.state?.mensagem ? { tipo: "sucesso", texto: location.state.mensagem } : null,
  );

  if (carregando) {
    return (
      <main className="acesso acesso-carregando" aria-busy="true" aria-live="polite">
        Verificando sua sessão…
      </main>
    );
  }
  if (usuario) return <Navigate to={destino} replace />;

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setAlerta(null);
    try {
      await login(email, senha);
      navigate(destino, { replace: true });
    } catch (erro) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(erro) });
      setEnviando(false);
    }
  }

  return (
    <main className="acesso">
      <div className="acesso-shell">
        <aside className="acesso-visual" aria-labelledby="acesso-mensagem">
          <Link className="acesso-marca" to="/catalogo" aria-label="Locadora — voltar ao catálogo">
            <span className="acesso-marca-simbolo" aria-hidden="true">L</span>
            <span>Locadora</span>
          </Link>
          <div className="acesso-visual-copy">
            <span className="acesso-etiqueta">Sua próxima viagem começa aqui</span>
            <h1 id="acesso-mensagem">Mais liberdade para chegar mais longe.</h1>
            <p>
              Entre para acompanhar suas reservas. Escolha o veículo, informe o período e receba
              uma cotação calculada para a sua viagem.
            </p>
            <div className="acesso-beneficios" aria-label="Recursos da locadora">
              <span>Cotação por período</span>
              <span>Histórico da locação</span>
              <span>Vistorias registradas</span>
            </div>
          </div>
          <p className="acesso-visual-rodape">Imagem ilustrativa · Locação clara, do início à devolução.</p>
        </aside>

        <section className="acesso-coluna" aria-label="Acesso à conta">
          <Link className="acesso-marca acesso-mobile-marca" to="/catalogo">
            <span className="acesso-marca-simbolo" aria-hidden="true">L</span>
            <span>Locadora</span>
          </Link>
          <form className="painel painel-acesso painel-login" onSubmit={enviar}>
            <p className="acesso-overline">Área do cliente</p>
            <h1>Acesse sua conta</h1>
            <p className="apoio">Entre para continuar sua reserva e acompanhar os detalhes da locação.</p>
            <Alert alerta={alerta} />
            <label htmlFor="login-email">
              E-mail
              <input
                id="login-email"
                name="email"
                type="email"
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                autoComplete="email"
                placeholder="voce@exemplo.com"
                required
                disabled={enviando}
              />
            </label>
            <label htmlFor="login-senha">
              Senha
              <div className="campo-senha">
                <input
                  id="login-senha"
                  name="senha"
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(evento) => setSenha(evento.target.value)}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  required
                  disabled={enviando}
                />
                <button
                  type="button"
                  className="senha-visibilidade"
                  onClick={() => setMostrarSenha((visivel) => !visivel)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={mostrarSenha}
                  disabled={enviando}
                >
                  {mostrarSenha ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>
            <button type="submit" className="botao botao-principal" disabled={enviando}>
              {enviando ? "Entrando..." : "Entrar na conta"}
            </button>
            <div className="acesso-links">
              <p className="troca">
                Ainda não tem conta? <Link to="/cadastro" state={location.state}>Criar conta</Link>
              </p>
              <Link className="acesso-voltar" to="/catalogo">Explorar veículos disponíveis</Link>
            </div>
          </form>
          <p className="acesso-privacidade">
            Suas reservas e dados da conta são exibidos conforme o seu perfil de acesso.
          </p>
        </section>
      </div>
    </main>
  );
}
