import api from "./api";

export async function cotar(payload) {
  const { data } = await api.post("/precificacao/cotacao", payload);
  return data;
}
export async function obterOpcoes(veiculoId) {
  const { data } = await api.get(`/precificacao/opcoes/${veiculoId}`);
  return data;
}
export async function obterAdmin() {
  const { data } = await api.get("/precificacao/admin");
  return data;
}
export async function salvarConfiguracao(campos) {
  const { data } = await api.patch("/precificacao/configuracao", campos);
  return data;
}
export async function salvarCustos(veiculoId, campos) {
  const { data } = await api.put(`/precificacao/custos/${veiculoId}`, campos);
  return data;
}
const cadastro = (recurso) => ({
  criar: async (campos) => (await api.post(`/precificacao/${recurso}`, campos)).data,
  atualizar: async (id, campos) => (await api.patch(`/precificacao/${recurso}/${id}`, campos)).data,
});
export const tarifas = cadastro("tarifas");
export const regras = cadastro("regras");
export const adicionais = cadastro("adicionais");
export const protecoes = cadastro("protecoes");
export const promocoes = cadastro("promocoes");
export const fidelidade = cadastro("fidelidade");
export async function salvarPiso(categoriaId, valor) {
  const { data } = await api.patch(`/precificacao/pisos/${categoriaId}`, { valor });
  return data;
}
export async function obterHistorico() {
  const { data } = await api.get("/precificacao/historico");
  return data;
}
