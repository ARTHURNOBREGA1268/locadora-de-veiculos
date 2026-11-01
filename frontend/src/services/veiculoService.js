import api from './api';

export async function cadastrar(dados) {
  const { data } = await api.post('/veiculos', dados);
  return data;
}

export async function listar(disponivel) {
  const params = disponivel === undefined ? {} : { disponivel };
  const { data } = await api.get('/veiculos', { params });
  return data;
}
