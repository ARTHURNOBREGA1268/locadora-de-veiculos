import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ adminOnly = false }) {
  const { usuario, carregando } = useAuth();
  const location = useLocation();

  if (carregando) {
    return <p className="carregando-pagina">Verificando sessão...</p>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (adminOnly && usuario.papel !== 'ADMIN') {
    return <Navigate to="/locacoes" replace />;
  }

  return <Outlet />;
}
