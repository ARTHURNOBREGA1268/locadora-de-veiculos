import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { tokenStorage } from '../services/api';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(tokenStorage.get()));

  useEffect(() => {
    if (!tokenStorage.get()) {
      setCarregando(false);
      return;
    }
    authService
      .perfil()
      .then(setUsuario)
      .catch(() => tokenStorage.clear())
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    const aoExpirar = () => setUsuario(null);
    window.addEventListener('auth:expirou', aoExpirar);
    return () => window.removeEventListener('auth:expirou', aoExpirar);
  }, []);

  const login = useCallback(async (email, senha) => {
    const { token, usuario: dados } = await authService.login(email, senha);
    tokenStorage.set(token);
    setUsuario(dados);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUsuario(null);
  }, []);

  const valor = useMemo(() => ({ usuario, carregando, login, logout }), [usuario, carregando, login, logout]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
