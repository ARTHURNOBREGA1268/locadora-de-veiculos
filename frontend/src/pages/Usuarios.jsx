import { useCallback, useEffect, useState } from 'react';
import * as usuarioService from '../services/usuarioService';
import { mensagemDeErro } from '../services/api';
import { useAuth } from '../context/AuthContext';

const formularioVazio = { nome: '', email: '', senha: '', papel: 'USER' };
function formatarData(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(data);
}
export default function Usuarios() {
  const { usuario: autenticado } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState(null);
  const [campos, setCampos] = useState(formularioVazio);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erroForm, setErroForm] = useState('');
  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try { const dados = await usuarioService.listar(); setUsuarios(Array.isArray(dados) ? dados : []); }
    catch (falha) { setErro(mensagemDeErro(falha)); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  function iniciarCadastro() { setMensagem(''); setErroForm(''); setCampos(formularioVazio); setForm({ tipo: 'novo' }); }
  function iniciarEdicao(alvo) {
    setMensagem(''); setErroForm('');
    setCampos({ nome: alvo.nome || '', email: alvo.email || '', senha: '', papel: alvo.papel || 'USER' });
    setForm({ tipo: 'editar', alvo });
  }
  function fecharForm() { if (!salvando) setForm(null); }
  async function salvar(evento) {
    evento.preventDefault(); setErroForm(''); setMensagem('');
    const proprio = form.tipo === 'editar' && String(form.alvo.id) === String(autenticado?.id);
    if (form.tipo === 'novo' && campos.papel === 'ADMIN' && !window.confirm('Conceder perfil de administrador a esta conta?')) return;
    if (form.tipo === 'editar' && !proprio && form.alvo.papel !== 'ADMIN' && campos.papel === 'ADMIN' && !window.confirm('Conceder perfil de administrador a esta conta?')) return;
    const payload = { nome: campos.nome.trim(), email: campos.email.trim() };
    if (!proprio) payload.papel = campos.papel;
    if (campos.senha) payload.senha = campos.senha;
    setSalvando(true);
    try {
      if (form.tipo === 'novo') await usuarioService.criar(payload);
      else await usuarioService.atualizar(form.alvo.id, payload);
      setForm(null); setMensagem(form.tipo === 'novo' ? 'Usuário cadastrado com sucesso.' : 'Usuário atualizado com sucesso.');
      await carregar();
    } catch (falha) { setErroForm(mensagemDeErro(falha)); }
    finally { setSalvando(false); }
  }
  async function alternarAtivo(alvo) {
    const ativo = alvo.ativo !== false;
    if (String(alvo.id) === String(autenticado?.id) && ativo) return;
    if (ativo && !window.confirm(`Inativar a conta de ${alvo.nome}? A conta será mantida no histórico.`)) return;
    setMensagem(''); setErro('');
    try {
      await usuarioService.atualizar(alvo.id, { ativo: !ativo });
      setMensagem(`Conta ${ativo ? 'inativada' : 'ativada'} com sucesso.`); await carregar();
    } catch (falha) { setErro(`Não foi possível ${ativo ? 'inativar' : 'ativar'} a conta: ${mensagemDeErro(falha)}`); }
  }
  return <>
    <div className="cabecalho-pagina"><h1>Usuários</h1><p className="apoio">Gerencie contas, perfis de acesso e situação cadastral.</p></div>
    {mensagem && <p className="usuarios-feedback" role="status">{mensagem}</p>}
    {form && <form className="painel usuarios-formulario" onSubmit={salvar}>
      <div className="usuarios-form-titulo"><h2>{form.tipo === 'novo' ? 'Cadastrar usuário' : `Editar usuário: ${form.alvo.nome}`}</h2><button type="button" className="botao botao-secundario" onClick={fecharForm} disabled={salvando}>Cancelar</button></div>
      {erroForm && <p className="usuarios-erro-inline" role="alert">{erroForm}</p>}
      <div className="usuarios-campos">
        <label>Nome<input name="nome" value={campos.nome} onChange={e => setCampos({ ...campos, nome: e.target.value })} required minLength={2} autoComplete="name" /></label>
        <label>E-mail<input name="email" type="email" value={campos.email} onChange={e => setCampos({ ...campos, email: e.target.value })} required autoComplete="email" /></label>
        <label>{form.tipo === 'novo' ? 'Senha inicial' : 'Redefinir senha (opcional)'}<input name="senha" type="password" value={campos.senha} onChange={e => setCampos({ ...campos, senha: e.target.value })} required={form.tipo === 'novo'} minLength={8} autoComplete="new-password" placeholder={form.tipo === 'editar' ? 'Deixe em branco para manter' : ''} /></label>
        {!(form.tipo === 'editar' && String(form.alvo.id) === String(autenticado?.id)) ? <label>Perfil<select name="papel" value={campos.papel} onChange={e => setCampos({ ...campos, papel: e.target.value })}><option value="USER">USER — Usuário</option><option value="ADMIN">ADMIN — Administrador</option></select></label> : <p className="usuarios-perfil-proprio">Seu perfil não pode ser alterado nesta tela.</p>}
      </div>
      <p className="apoio">A senha inicial não será exibida após salvar. Senha opcional deve ter ao menos 8 caracteres.</p>
      <button type="submit" className="botao botao-principal" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar usuário'}</button>
    </form>}
    <section className="painel painel-usuarios" aria-labelledby="titulo-lista-usuarios">
      <div className="barra-filtro usuarios-barra"><div><h2 id="titulo-lista-usuarios">Contas cadastradas</h2>{!carregando && !erro && <p className="apoio usuarios-contagem">{usuarios.length} {usuarios.length === 1 ? 'usuário' : 'usuários'}</p>}</div><div className="usuarios-acoes-topo"><button type="button" className="botao botao-principal" onClick={iniciarCadastro}>Cadastrar usuário</button><button type="button" className="botao botao-secundario" onClick={carregar} disabled={carregando}>{carregando ? 'Atualizando…' : 'Atualizar lista'}</button></div></div>
      {erro && <div className="usuarios-erro" role="alert"><p><strong>Não foi possível concluir a operação.</strong></p><p>{erro}</p><button type="button" className="botao botao-secundario" onClick={carregar}>Tentar novamente</button></div>}
      {carregando ? <p className="carregando-pagina" role="status">Carregando usuários…</p> : !erro && usuarios.length === 0 ? <div className="vazio usuarios-vazio">Nenhum usuário cadastrado.</div> : !erro && <div className="tabela-usuarios-scroll"><table className="tabela-usuarios"><thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Perfil</th><th scope="col">Estado</th><th scope="col">Data de cadastro</th><th scope="col">Ações</th></tr></thead><tbody>
        {usuarios.map(u => { const proprio = String(u.id) === String(autenticado?.id); const ativo = u.ativo !== false; return <tr key={u.id}><td data-label="Nome"><span className="usuario-tabela-nome">{u.nome || '—'}</span>{proprio && <span className="apoio usuarios-proprio"> (você)</span>}</td><td data-label="E-mail">{u.email || '—'}</td><td data-label="Perfil"><span className={`selo ${u.papel === 'ADMIN' ? 'selo-admin' : 'selo-user'}`}>{u.papel === 'ADMIN' ? 'ADMIN' : 'USER'}</span></td><td data-label="Estado"><span className={`selo ${ativo ? 'selo-ativo' : 'selo-inativo'}`}>{ativo ? 'Ativo' : 'Inativo'}</span></td><td data-label="Data de cadastro">{formatarData(u.criadoEm)}</td><td data-label="Ações"><div className="usuarios-acoes"><button type="button" className="botao botao-secundario" onClick={() => iniciarEdicao(u)}>Editar</button>{!proprio && <button type="button" className="botao botao-secundario" onClick={() => alternarAtivo(u)}>{ativo ? 'Inativar' : 'Ativar'}</button>}</div></td></tr>; })}
      </tbody></table></div>}
    </section>
  </>;
}
