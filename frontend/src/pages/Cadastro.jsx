import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registrar } from '../services/authService';
import { mensagemDeErro } from '../services/api';
import Alert from '../components/Alert';

export default function Cadastro() {
  const { usuario, carregando } = useAuth();
  const navigate = useNavigate();
  const [campos, setCampos] = useState({ nome: '', email: '', senha: '' });
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState(null);

  if (carregando) return null;
  if (usuario) return <Navigate to="/locacoes" replace />;

  function alterar(evento) {
    setCampos({ ...campos, [evento.target.name]: evento.target.value });
  }

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setAlerta(null);
    try {
      await registrar(campos);
      navigate('/login', { state: { mensagem: 'Conta criada. Entre com seu e-mail e senha.' } });
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
      setEnviando(false);
    }
  }

  return (
    <div className="acesso">
      <form className="painel painel-acesso" onSubmit={enviar}>
        <h1>Criar conta</h1>
        <p className="apoio">Use seu e-mail para acessar o sistema. A senha precisa ter ao menos 6 caracteres.</p>
        <Alert alerta={alerta} />
        <label>
          Nome
          <input name="nome" value={campos.nome} onChange={alterar} autoComplete="name" required minLength={2} />
        </label>
        <label>
          E-mail
          <input name="email" type="email" value={campos.email} onChange={alterar} autoComplete="email" required />
        </label>
        <label>
          Senha
          <input name="senha" type="password" value={campos.senha} onChange={alterar} autoComplete="new-password" required minLength={6} />
        </label>
        <button type="submit" className="botao botao-principal" disabled={enviando}>
          {enviando ? 'Criando conta...' : 'Criar conta'}
        </button>
        <p className="troca">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
