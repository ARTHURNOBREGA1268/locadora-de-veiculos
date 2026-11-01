import api from "./api";

export async function obter() {
  const { data } = await api.get("/configuracoes/locacao");
  return data;
}

export async function salvar(configuracao) {
  const { data } = await api.put("/configuracoes/locacao", configuracao);
  return data;
}
