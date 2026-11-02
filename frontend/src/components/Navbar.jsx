import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { usuario, carregando, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const admin = usuario?.papel === "ADMIN";

  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  function fecharMenu() {
    setMenuAberto(false);
  }

  function sair() {
    fecharMenu();
    logout();
    navigate("/catalogo");
  }

  return (
    <header className="topo">
      <div className={`topo-conteudo${menuAberto ? " nav-aberto" : ""}`}>
        <NavLink
          className="marca marca-link"
          to="/catalogo"
          aria-label="Locadora — catálogo"
          onClick={fecharMenu}
        >
          Locadora
        </NavLink>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuAberto}
          aria-controls="menu-principal"
          aria-label={menuAberto ? "Fechar menu de navegação" : "Abrir menu de navegação"}
          onClick={() => setMenuAberto((aberto) => !aberto)}
        >
          {menuAberto ? "Fechar" : "Menu"}
        </button>
        <nav
          id="menu-principal"
          className={`menu${menuAberto ? " menu-aberto" : ""}`}
          aria-label="Navegação principal"
        >
          <NavLink to="/catalogo" end onClick={fecharMenu}>
            Catálogo
          </NavLink>
          {usuario && (
            <NavLink to="/locacoes" onClick={fecharMenu}>
              {admin ? "Locações" : "Minhas locações"}
            </NavLink>
          )}
          {admin && <NavLink to="/clientes" onClick={fecharMenu}>Clientes</NavLink>}
          {admin && <NavLink to="/veiculos" onClick={fecharMenu}>Frota</NavLink>}
          {admin && <NavLink to="/precificacao" onClick={fecharMenu}>Precificação</NavLink>}
          {admin && <NavLink to="/configuracoes/locacao" onClick={fecharMenu}>Regras de locação</NavLink>}
          {admin && <NavLink to="/usuarios" onClick={fecharMenu}>Usuários</NavLink>}
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
            <NavLink className="nav-entrar" to="/login" onClick={fecharMenu}>
              Entrar
            </NavLink>
            <NavLink className="botao botao-claro nav-cadastrar" to="/cadastro" onClick={fecharMenu}>
              Criar conta
            </NavLink>
          </div>
        )}
      </div>
    </header>
  );
}
