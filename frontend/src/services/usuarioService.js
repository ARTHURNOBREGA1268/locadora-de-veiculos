import api from './api';

export async function listar() {
  const { data } = await api.get('/usuarios');
  return data;
}
