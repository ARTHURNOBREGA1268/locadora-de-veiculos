import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { mensagemDeErro } from '../services/api';
import Alert from '../components/Alert';

export default function Login() {
  const { usuario, carregando, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState(
    location.state?.mensagem ? { tipo: 'sucesso', texto: location.state.mensagem } : null
  );

  if (carregando) return null;
  if (usuario) return <Navigate to="/locacoes" replace />;

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setAlerta(null);
    try {
      await login(email, senha);
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
      setEnviando(false);
    }
  }

  return (
    <div className="acesso">
      <form className="painel painel-acesso" onSubmit={enviar}>
        <h1>Entrar</h1>
        <p className="apoio">Acesse sua conta para gerenciar veículos e locações.</p>
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
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
        <p className="troca">
          Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
