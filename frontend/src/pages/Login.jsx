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
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState(
    location.state?.mensagem ? { tipo: "sucesso", texto: location.state.mensagem } : null,
  );

  if (carregando) return null;
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
    <div className="acesso">
      <form className="painel painel-acesso" onSubmit={enviar}>
        <h1>Entrar</h1>
        <p className="apoio">Acesse sua conta para concluir a reserva e acompanhar suas locações.</p>
        <Alert alerta={alerta} />
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        </label>
        <button type="submit" className="botao botao-principal" disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
        <p className="troca">
          Ainda não tem conta? <Link to="/cadastro" state={location.state}>Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
