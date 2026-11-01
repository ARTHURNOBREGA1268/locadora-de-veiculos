import api from "./api";

export async function registrar(dados) {
  const { data } = await api.post("/locacoes", dados);
  return data;
}

export async function listar() {
  const { data } = await api.get("/locacoes");
  return data;
}

export async function transicionar(id, acao) {
  const permitidas = [
    "retirar",
    "iniciar",
    "devolver",
    "finalizar",
    "cancelar",
  ];
  if (!permitidas.includes(acao)) throw new Error("Ação de locação inválida.");
  const { data } = await api.patch(`/locacoes/${id}/${acao}`);
  return data;
}

export async function finalizar(id) {
  return transicionar(id, "finalizar");
}
