const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret-for-rental-finalization-123456";
process.env.CORS_ORIGIN = "http://localhost:5173";

const prisma = require("../src/lib/prisma");
const app = require("../src/app");

function substituirTemporariamente(alvo, chave, valor, t) {
  const original = Object.getOwnPropertyDescriptor(alvo, chave);
  Object.defineProperty(alvo, chave, {
    configurable: true,
    writable: true,
    value: valor,
  });
  t.after(() => {
    if (original) Object.defineProperty(alvo, chave, original);
    else delete alvo[chave];
  });
}

function autenticarUsuarioAtivo(t) {
  substituirTemporariamente(
    prisma.usuario,
    "findUnique",
    async () => ({ ativo: true, papel: "USER", tokenVersion: 0 }),
    t,
  );
}

async function iniciarServidor(t, acao) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: "11",
    algorithm: "HS256",
  });
  return {
    url: `http://127.0.0.1:${server.address().port}/locacoes/42/${acao}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

function mockLocacaoAtiva(t, locacao, veiculoStatus, { corrida = false } = {}) {
  const statusVeiculoEsperado =
    locacao.status === "em_andamento" ? "alugado" : "reservado";
  substituirTemporariamente(
    prisma.locacao,
    "findUnique",
    async () => ({
      ...locacao,
      veiculo: { id: locacao.veiculoId, status: veiculoStatus },
    }),
    t,
  );
  substituirTemporariamente(
    prisma,
    "$transaction",
    async (operacao) =>
      operacao({
        locacao: {
          updateMany: async ({ where, data }) => {
            assert.deepEqual(where, {
              id: locacao.id,
              usuarioId: locacao.usuarioId,
              status: locacao.status,
            });
            if (corrida) return { count: 0 };
            Object.assign(locacao, data);
            return { count: 1 };
          },
          findUnique: async () => ({
            ...locacao,
            veiculo: { id: locacao.veiculoId, status: veiculoStatus },
          }),
        },
        veiculo: {
          updateMany: async ({ where, data }) => {
            assert.deepEqual(where, {
              id: locacao.veiculoId,
              status: statusVeiculoEsperado,
            });
            if (corrida || veiculoStatus !== statusVeiculoEsperado)
              return { count: 0 };
            veiculoStatus = data.status;
            return { count: 1 };
          },
        },
      }),
    t,
  );
}

test("devolução registra o horário efetivo e libera o veículo", async (t) => {
  autenticarUsuarioAtivo(t);
  const locacao = {
    id: 42,
    usuarioId: 11,
    veiculoId: 7,
    status: "em_andamento",
    dataDevolucaoEfetiva: null,
  };
  let veiculoStatus = "alugado";
  substituirTemporariamente(
    prisma.locacao,
    "findUnique",
    async () => ({ ...locacao, veiculo: { id: 7, status: veiculoStatus } }),
    t,
  );
  substituirTemporariamente(
    prisma,
    "$transaction",
    async (operacao) =>
      operacao({
        locacao: {
          updateMany: async ({ where, data }) => {
            assert.deepEqual(where, {
              id: 42,
              usuarioId: 11,
              status: "em_andamento",
            });
            Object.assign(locacao, data);
            return { count: 1 };
          },
          findUnique: async () => ({
            ...locacao,
            veiculo: { id: 7, status: veiculoStatus },
          }),
        },
        veiculo: {
          updateMany: async ({ where, data }) => {
            assert.deepEqual(where, {
              id: 7,
              status: "alugado",
            });
            veiculoStatus = data.status;
            return { count: 1 };
          },
        },
      }),
    t,
  );
  const { url, headers } = await iniciarServidor(t, "devolver");
  const resposta = await fetch(url, { method: "PATCH", headers });
  const corpo = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "devolvida");
  assert.equal(corpo.veiculo.status, "disponivel");
  assert.ok(Number.isFinite(Date.parse(corpo.dataDevolucaoEfetiva)));
  assert.equal(veiculoStatus, "disponivel");
});

test("devolução não sobrescreve manutenção definida pelo ADMIN", async (t) => {
  autenticarUsuarioAtivo(t);
  const locacao = {
    id: 42,
    usuarioId: 11,
    veiculoId: 7,
    status: "em_andamento",
  };
  mockLocacaoAtiva(t, locacao, "manutencao");
  const { url, headers } = await iniciarServidor(t, "devolver");
  const resposta = await fetch(url, { method: "PATCH", headers });
  const corpo = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "devolvida");
  assert.equal(corpo.veiculo.status, "manutencao");
});

test("rejeita a devolução repetida sem iniciar outra transação", async (t) => {
  autenticarUsuarioAtivo(t);
  substituirTemporariamente(
    prisma.locacao,
    "findUnique",
    async () => ({
      id: 42,
      usuarioId: 11,
      veiculoId: 7,
      status: "finalizada",
      veiculo: { id: 7, status: "disponivel" },
    }),
    t,
  );
  let transacoes = 0;
  substituirTemporariamente(
    prisma,
    "$transaction",
    async () => {
      transacoes += 1;
      throw new Error("A transação não deveria iniciar");
    },
    t,
  );
  const { url, headers } = await iniciarServidor(t, "devolver");
  const resposta = await fetch(url, { method: "PATCH", headers });
  assert.equal(resposta.status, 409);
  assert.match((await resposta.json()).erro, /Transição não permitida/);
  assert.equal(transacoes, 0);
});

test("corrida perdida não libera o veículo", async (t) => {
  autenticarUsuarioAtivo(t);
  const locacao = {
    id: 42,
    usuarioId: 11,
    veiculoId: 7,
    status: "em_andamento",
  };
  mockLocacaoAtiva(t, locacao, "alugado", { corrida: true });
  let atualizacoesVeiculo = 0;
  substituirTemporariamente(
    prisma,
    "$transaction",
    async (operacao) =>
      operacao({
        locacao: {
          updateMany: async ({ where }) => {
            assert.deepEqual(where, {
              id: 42,
              usuarioId: 11,
              status: "em_andamento",
            });
            return { count: 0 };
          },
        },
        veiculo: {
          updateMany: async () => {
            atualizacoesVeiculo += 1;
            return { count: 1 };
          },
        },
      }),
    t,
  );
  const { url, headers } = await iniciarServidor(t, "devolver");
  const resposta = await fetch(url, { method: "PATCH", headers });
  assert.equal(resposta.status, 409);
  assert.deepEqual(await resposta.json(), {
    erro: "Estado da locação alterado por outra operação",
  });
  assert.equal(atualizacoesVeiculo, 0);
});

test("finaliza apenas locação devolvida e não altera o estado do veículo", async (t) => {
  autenticarUsuarioAtivo(t);
  const locacao = {
    id: 42,
    usuarioId: 11,
    veiculoId: 7,
    status: "devolvida",
  };
  substituirTemporariamente(
    prisma.locacao,
    "findUnique",
    async () => ({ ...locacao, veiculo: { id: 7, status: "disponivel" } }),
    t,
  );
  substituirTemporariamente(
    prisma,
    "$transaction",
    async (operacao) =>
      operacao({
        locacao: {
          updateMany: async ({ where, data }) => {
            assert.deepEqual(where, {
              id: 42,
              usuarioId: 11,
              status: "devolvida",
            });
            Object.assign(locacao, data);
            return { count: 1 };
          },
          findUnique: async () => ({
            ...locacao,
            veiculo: { id: 7, status: "disponivel" },
          }),
        },
      }),
    t,
  );
  const { url, headers } = await iniciarServidor(t, "finalizar");
  const resposta = await fetch(url, { method: "PATCH", headers });
  const corpo = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "finalizada");
  assert.equal(corpo.veiculo.status, "disponivel");
});

test("retirada muda a locação para retirada e o veículo para alugado", async (t) => {
  autenticarUsuarioAtivo(t);
  const locacao = {
    id: 42,
    usuarioId: 11,
    veiculoId: 7,
    status: "reservada",
  };
  let veiculoStatus = "reservado";
  substituirTemporariamente(
    prisma.locacao,
    "findUnique",
    async () => ({ ...locacao, veiculo: { id: 7, status: veiculoStatus } }),
    t,
  );
  substituirTemporariamente(
    prisma,
    "$transaction",
    async (operacao) =>
      operacao({
        locacao: {
          updateMany: async ({ where, data }) => {
            assert.deepEqual(where, {
              id: 42,
              usuarioId: 11,
              status: "reservada",
            });
            Object.assign(locacao, data);
            return { count: 1 };
          },
          findUnique: async () => ({
            ...locacao,
            veiculo: { id: 7, status: veiculoStatus },
          }),
        },
        veiculo: {
          updateMany: async ({ where, data }) => {
            assert.deepEqual(where, { id: 7, status: "reservado" });
            veiculoStatus = data.status;
            return { count: 1 };
          },
        },
      }),
    t,
  );
  const { url, headers } = await iniciarServidor(t, "retirar");
  const resposta = await fetch(url, { method: "PATCH", headers });
  const corpo = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "retirada");
  assert.equal(corpo.veiculo.status, "alugado");
});
