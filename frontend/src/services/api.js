import axios from 'axios';

const TOKEN_KEY = 'locadora_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY)
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333'
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const rotaPublica = url.startsWith('/auth/login') || url.startsWith('/auth/register');
    if (error.response?.status === 401 && !rotaPublica) {
      tokenStorage.clear();
      window.dispatchEvent(new Event('auth:expirou'));
    }
    return Promise.reject(error);
  }
);

export function mensagemDeErro(error) {
  return error.response?.data?.erro || 'Não foi possível conectar à API. Verifique se o servidor está ativo.';
}

export default api;
