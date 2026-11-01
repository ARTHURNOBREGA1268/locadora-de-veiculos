import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return <p className="carregando-pagina">Verificando sessão...</p>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
