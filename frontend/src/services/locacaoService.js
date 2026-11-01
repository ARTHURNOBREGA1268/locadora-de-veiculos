import api from "./api";

export async function registrar(dados) {
  const { data } = await api.post("/locacoes", dados);
  return data;
}

export async function listar() {
  const { data } = await api.get("/locacoes");
  return data;
}

export async function listarChecklist() {
  const { data } = await api.get("/locacoes/checklist");
  return data;
}

export async function registrarCobrancaExtra(id, dados) {
  const { data } = await api.post(`/locacoes/${id}/cobrancas-extras`, dados);
  return data;
}

export async function marcarContratoAssinado(id) {
  const { data } = await api.patch(`/locacoes/${id}/contrato-assinado`);
  return data;
}

export async function transicionar(id, acao, dados = {}) {
  const permitidas = [
    "retirar",
    "iniciar",
    "devolver",
    "finalizar",
    "cancelar",
  ];
  if (!permitidas.includes(acao)) throw new Error("Ação de locação inválida.");
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw new Error("Dados da transição inválidos.");
  }
  const { data } = await api.patch(`/locacoes/${id}/${acao}`, dados);
  return data;
}

export async function finalizar(id) {
  return transicionar(id, "finalizar");
}
