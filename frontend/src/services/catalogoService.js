import api from "./api";

export async function listarVeiculos() {
  const { data } = await api.get("/catalogo/veiculos");
  return data;
}

export async function obterRegras() {
  const { data } = await api.get("/catalogo/regras");
  return data;
}
