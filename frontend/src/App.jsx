import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Veiculos from './pages/Veiculos';
import Locacoes from './pages/Locacoes';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/locacoes" element={<Locacoes />} />
          <Route path="/veiculos" element={<Veiculos />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/locacoes" replace />} />
    </Routes>
  );
}
