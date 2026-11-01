import { useCallback, useEffect, useState } from 'react';
import * as usuarioService from '../services/usuarioService';
import { mensagemDeErro } from '../services/api';

function formatarData(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(data);
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await usuarioService.listar();
      setUsuarios(Array.isArray(dados) ? dados : []);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Usuários</h1>
        <p className="apoio">Consulte as contas cadastradas e seus perfis de acesso.</p>
      </div>

      <section className="painel painel-usuarios" aria-labelledby="titulo-lista-usuarios">
        <div className="barra-filtro usuarios-barra">
          <div>
            <h2 id="titulo-lista-usuarios">Contas cadastradas</h2>
            {!carregando && !erro && <p className="apoio usuarios-contagem">{usuarios.length} {usuarios.length === 1 ? 'usuário' : 'usuários'}</p>}
          </div>
          <button type="button" className="botao botao-secundario" onClick={carregar} disabled={carregando}>
            {carregando ? 'Atualizando…' : 'Atualizar lista'}
          </button>
        </div>

        {carregando ? (
          <p className="carregando-pagina" role="status">Carregando usuários…</p>
        ) : erro ? (
          <div className="usuarios-erro" role="alert">
            <p><strong>Não foi possível carregar os usuários.</strong></p>
            <p>{erro}</p>
            <button type="button" className="botao botao-secundario" onClick={carregar}>Tentar novamente</button>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="vazio usuarios-vazio">Nenhum usuário cadastrado.</div>
        ) : (
          <div className="tabela-usuarios-scroll">
            <table className="tabela-usuarios">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Perfil</th>
                  <th scope="col">Data de cadastro</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td data-label="Nome"><span className="usuario-tabela-nome">{usuario.nome || '—'}</span></td>
                    <td data-label="E-mail">{usuario.email || '—'}</td>
                    <td data-label="Perfil">
                      <span className={`selo ${usuario.papel === 'ADMIN' ? 'selo-admin' : 'selo-user'}`}>
                        {usuario.papel === 'ADMIN' ? 'Administrador' : 'Usuário'}
                      </span>
                    </td>
                    <td data-label="Data de cadastro">{formatarData(usuario.criadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
