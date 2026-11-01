import { useCallback, useEffect, useState } from 'react';
import * as clienteService from '../services/clienteService';
import * as usuarioService from '../services/usuarioService';
import { mensagemDeErro } from '../services/api';

const vazio = { nome: '', cpf: '', email: '', telefone: '', usuarioId: '', ativo: true };
export default function Clientes() {
  const [clientes, setClientes] = useState([]), [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState(''), [ativo, setAtivo] = useState('true');
  const [form, setForm] = useState(null), [campos, setCampos] = useState(vazio);
  const [carregando, setCarregando] = useState(true), [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(''), [mensagem, setMensagem] = useState('');
  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try { const lista = await clienteService.listar({ busca, ativo: ativo === '' ? undefined : ativo === 'true' }); setClientes(Array.isArray(lista) ? lista : []); }
    catch (e) { setErro(mensagemDeErro(e)); } finally { setCarregando(false); }
  }, [busca, ativo]);
  useEffect(() => { const timer = setTimeout(carregar, 250); return () => clearTimeout(timer); }, [carregar]);
  useEffect(() => { usuarioService.listar().then(d => setUsuarios((Array.isArray(d) ? d : []).filter(u => u.papel === 'USER' || u.papel === 'ADMIN'))).catch(() => setUsuarios([])); }, []);
  function novo() { setCampos(vazio); setForm({ tipo: 'novo' }); setErro(''); }
  function editar(c) { setCampos({ nome: c.nome || '', cpf: c.cpf || '', email: c.email || '', telefone: c.telefone || '', usuarioId: c.usuarioId ?? c.usuario?.id ?? '', ativo: c.ativo !== false }); setForm({ tipo: 'editar', alvo: c }); setErro(''); }
  async function salvar(e) { e.preventDefault(); setSalvando(true); setErro(''); try {
    const payload = { nome: campos.nome.trim(), cpf: campos.cpf.trim() || null, email: campos.email.trim() || null, telefone: campos.telefone.trim() || null, usuarioId: campos.usuarioId ? Number(campos.usuarioId) : null };
    if (form.tipo === 'novo') payload.ativo = Boolean(campos.ativo);
    else payload.ativo = Boolean(campos.ativo);
    if (form.tipo === 'novo') await clienteService.criar(payload); else await clienteService.atualizar(form.alvo.id, payload);
    setForm(null); setMensagem('Cliente salvo com sucesso.'); await carregar();
  } catch (e2) { setErro(mensagemDeErro(e2)); } finally { setSalvando(false); } }
  async function alternar(c) { const novoEstado = c.ativo === false; setErro(''); try { await clienteService.atualizar(c.id, { ativo: novoEstado }); setMensagem(`Cliente ${novoEstado ? 'ativado' : 'inativado'} com sucesso.`); await carregar(); } catch (e) { setErro(mensagemDeErro(e)); } }
  return <>
    <div className="cabecalho-pagina"><h1>Clientes</h1><p className="apoio">Cadastre clientes e, opcionalmente, associe-os a uma conta. Nenhuma credencial é exibida ou gerenciada aqui.</p></div>
    {mensagem && <p className="clientes-feedback" role="status">{mensagem}</p>}{erro && <p className="clientes-erro" role="alert">{erro}</p>}
    {form && <form className="painel formulario" onSubmit={salvar}><div className="clientes-form-titulo"><h2>{form.tipo === 'novo' ? 'Novo cliente' : 'Editar cliente'}</h2><button type="button" className="botao botao-secundario" onClick={() => setForm(null)} disabled={salvando}>Cancelar</button></div>
      <div className="grade-campos"><label>Nome<input value={campos.nome} onChange={e => setCampos({ ...campos, nome: e.target.value })} required minLength={2} autoComplete="off" /></label><label>CPF (opcional)<input value={campos.cpf} onChange={e => setCampos({ ...campos, cpf: e.target.value })} maxLength={14} inputMode="numeric" autoComplete="off" /></label><label>E-mail de contato (opcional)<input type="email" maxLength={191} value={campos.email} onChange={e => setCampos({ ...campos, email: e.target.value })} autoComplete="email" /></label><label>Telefone (opcional)<input type="tel" maxLength={30} value={campos.telefone} onChange={e => setCampos({ ...campos, telefone: e.target.value })} autoComplete="tel" /></label>
      <label>Conta vinculada (opcional)<select value={campos.usuarioId} onChange={e => setCampos({ ...campos, usuarioId: e.target.value })}><option value="">Sem vínculo</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nome} — {u.papel}</option>)}</select></label><label>Estado<select value={String(campos.ativo)} onChange={e => setCampos({ ...campos, ativo: e.target.value === 'true' })}><option value="true">Ativo</option><option value="false">Inativo</option></select></label></div>
      <p className="apoio">A associação não concede acesso; perfis e credenciais são gerenciados separadamente.</p><button className="botao botao-principal" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar cliente'}</button>
    </form>}
    <section className="painel painel-clientes"><div className="clientes-filtros"><label>Buscar por nome, CPF ou contato<input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome, CPF, e-mail ou telefone…" /></label><label>Estado<select value={ativo} onChange={e => setAtivo(e.target.value)}><option value="">Todos</option><option value="true">Ativos</option><option value="false">Inativos</option></select></label><button type="button" className="botao botao-principal" onClick={novo}>Cadastrar cliente</button></div>
      {carregando ? <p className="carregando-pagina">Carregando clientes…</p> : clientes.length === 0 ? <p className="vazio">Nenhum cliente encontrado para estes filtros.</p> : <div className="tabela-clientes-scroll"><table className="tabela-clientes"><thead><tr><th>Nome</th><th>CPF</th><th>Contatos</th><th>Conta vinculada</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{clientes.map(c => <tr key={c.id}><td data-label="Nome">{c.nome || '—'}</td><td data-label="CPF">{c.cpf || '—'}</td><td data-label="Contatos">{c.email || '—'}<br />{c.telefone || '—'}</td><td data-label="Conta vinculada">{c.usuario?.nome ? `${c.usuario.nome} (${c.usuario.papel || 'conta'})` : 'Sem vínculo'}</td><td data-label="Estado"><span className={`selo ${c.ativo === false ? 'selo-inativo' : 'selo-ativo'}`}>{c.ativo === false ? 'Inativo' : 'Ativo'}</span></td><td data-label="Ações"><div className="clientes-acoes"><button type="button" className="botao botao-secundario" onClick={() => editar(c)}>Editar</button><button type="button" className="botao botao-secundario" onClick={() => alternar(c)}>{c.ativo === false ? 'Ativar' : 'Inativar'}</button></div></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
