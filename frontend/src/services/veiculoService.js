import api from "./api";

export async function listar(params = {}) {
  const { data } = await api.get("/veiculos", { params });
  return data;
}

export async function metadados() {
  const { data } = await api.get("/veiculos/metadados");
  return data;
}

export async function obter(id) {
  const { data } = await api.get(`/veiculos/${id}`);
  return data;
}

export async function cadastrar(dados) {
  const { data } = await api.post("/veiculos", dados);
  return data;
}

export async function atualizar(id, dados) {
  const { data } = await api.patch(`/veiculos/${id}`, dados);
  return data;
}

export async function historico(id) {
  const { data } = await api.get(`/veiculos/${id}/historico`);
  return data;
}

export async function locacoesVinculadas(id) {
  const { data } = await api.get(`/veiculos/${id}/locacoes`);
  return data;
}

export async function cadastrarHistorico(id, tipo, dados) {
  const rotas = {
    manutencoes: "manutencoes",
    sinistrosAvarias: "sinistros",
    multas: "multas",
    vistorias: "vistorias",
  };
  const { data } = await api.post(`/veiculos/${id}/${rotas[tipo]}`, dados);
  return data;
}
