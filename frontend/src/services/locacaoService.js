import api from './api';

export async function registrar(dados) {
  const { data } = await api.post('/locacoes', dados);
  return data;
}

export async function listar() {
  const { data } = await api.get('/locacoes');
  return data;
}

export async function finalizar(id) {
  const { data } = await api.patch(`/locacoes/${id}/finalizar`);
  return data;
}
