import api from './api';

export async function proprio() {
  const { data } = await api.get('/clientes/me');
  return data;
}
export async function listar({ busca = '', ativo } = {}) {
  const params = {};
  if (busca.trim()) params.busca = busca.trim();
  if (ativo !== undefined) params.ativo = String(ativo);
  const { data } = await api.get('/clientes', { params });
  return data;
}
export async function criar(cliente) {
  const { data } = await api.post('/clientes', cliente);
  return data;
}
export async function atualizar(id, campos) {
  const { data } = await api.patch(`/clientes/${id}`, campos);
  return data;
}
