import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { usuario, carregando, logout } = useAuth();
  const navigate = useNavigate();
  const admin = usuario?.papel === "ADMIN";

  function sair() {
    logout();
    navigate("/catalogo");
  }

  return (
    <header className="topo">
      <div className="topo-conteudo">
        <NavLink className="marca marca-link" to="/catalogo" aria-label="Locadora — catálogo">
          Locadora
        </NavLink>
        <nav className="menu" aria-label="Navegação principal">
          <NavLink to="/catalogo" end>Catálogo</NavLink>
          {usuario && (
            <NavLink to="/locacoes">
              {admin ? "Locações" : "Minhas locações"}
            </NavLink>
          )}
          {admin && <NavLink to="/clientes">Clientes</NavLink>}
          {admin && <NavLink to="/veiculos">Frota</NavLink>}
          {admin && <NavLink to="/precificacao">Precificação</NavLink>}
          {admin && <NavLink to="/configuracoes/locacao">Regras de locação</NavLink>}
          {admin && <NavLink to="/usuarios">Usuários</NavLink>}
        </nav>
        {usuario ? (
          <div className="usuario">
            <span className="usuario-nome">{usuario.nome}</span>
            <button type="button" className="botao botao-claro" onClick={sair}>
              Sair
            </button>
          </div>
        ) : carregando ? (
          <div className="usuario usuario-carregando" aria-label="Verificando sessão" />
        ) : (
          <div className="usuario usuario-visitante">
            <NavLink className="nav-entrar" to="/login">Entrar</NavLink>
            <NavLink className="botao botao-claro nav-cadastrar" to="/cadastro">
              Criar conta
            </NavLink>
          </div>
        )}
      </div>
    </header>
  );
}
