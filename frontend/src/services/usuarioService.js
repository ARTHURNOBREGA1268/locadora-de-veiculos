import api from './api';

export async function listar() {
  const { data } = await api.get('/usuarios');
  return data;
}
export async function criar(usuario) {
  const { data } = await api.post('/usuarios', usuario);
  return data;
}
export async function atualizar(id, campos) {
  const { data } = await api.patch(`/usuarios/${id}`, campos);
  return data;
}
