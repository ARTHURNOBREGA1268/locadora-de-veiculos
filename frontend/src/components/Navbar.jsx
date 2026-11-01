import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function sair() {
    logout();
    navigate("/login");
  }

  return (
    <header className="topo">
      <div className="topo-conteudo">
        <span className="marca">Locadora</span>
        <nav className="menu" aria-label="Principal">
          <NavLink to="/locacoes">Locações</NavLink>
          <NavLink to="/veiculos">Veículos</NavLink>
          {usuario.papel === "ADMIN" && <NavLink to="/clientes">Clientes</NavLink>}
          {usuario.papel === "ADMIN" && (
            <NavLink to="/usuarios">Usuários</NavLink>
          )}
          {usuario.papel === "ADMIN" && (
            <NavLink to="/precificacao">Precificação</NavLink>
          )}
          {usuario.papel === "ADMIN" && (
            <NavLink to="/configuracoes/locacao">Configurações</NavLink>
          )}
        </nav>
        <div className="usuario">
          <span className="usuario-nome">{usuario.nome}</span>
          <button type="button" className="botao botao-claro" onClick={sair}>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
