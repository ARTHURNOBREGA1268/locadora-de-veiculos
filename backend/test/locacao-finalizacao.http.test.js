const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret-for-rental-finalization-123456";
process.env.CORS_ORIGIN = "http://localhost:5173";

const prisma = require("../src/lib/prisma");
const app = require("../src/app");
function autenticarUsuarioAtivo(t) {
  const delegate = prisma.usuario;
  const original = delegate.findUnique;
  Object.defineProperty(delegate, "findUnique", {
    configurable: true,
    writable: true,
    value: async () => ({ ativo: true, papel: "USER" }),
  });
  t.after(() => {
    if (original === undefined) delete delegate.findUnique;
    else delegate.findUnique = original;
  });
}

function substituirTemporariamente(alvo, chave, valor, t) {
  Object.defineProperty(alvo, chave, {
    configurable: true,
    writable: true,
    value: valor,
  });
  t.after(() => {
    delete alvo[chave];
  });
}

async function iniciarServidor(t) {
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
    url: `http://127.0.0.1:${server.address().port}/locacoes/42/finalizar`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

test("finalização bem-sucedida registra devolução e libera o veículo", async (t) => {
  autenticarUsuarioAtivo(t);
  const estado = {
    locacao: {
      id: 42,
      usuarioId: 11,
      veiculoId: 7,
      status: "ATIVA",
      dataDevolucaoEfetiva: null,
    },
    veiculoStatus: "alugado",
  };

  substituirTemporariamente(
    prisma.locacao,
    "findUnique",
    async () => ({
      ...estado.locacao,
      veiculo: { id: 7, status: estado.veiculoStatus },
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
            assert.deepEqual(where, { id: 42, status: "ATIVA" });
            estado.locacao.status = data.status;
            estado.locacao.dataDevolucaoEfetiva = data.dataDevolucaoEfetiva;
            return { count: 1 };
          },
          findUnique: async () => ({
            ...estado.locacao,
            veiculo: { id: 7, status: estado.veiculoStatus },
          }),
        },
        veiculo: {
          updateMany: async ({ where, data }) => {
            assert.deepEqual(where, {
              id: 7,
              status: { in: ["alugado", "reservado"] },
            });
            if (["alugado", "reservado"].includes(estado.veiculoStatus)) {
              estado.veiculoStatus = data.status;
              return { count: 1 };
            }
            return { count: 0 };
          },
        },
      }),
    t,
  );

  const { url, headers } = await iniciarServidor(t);
  const resposta = await fetch(url, { method: "PATCH", headers });
  const corpo = await resposta.json();

  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "FINALIZADA");
  assert.equal(corpo.veiculo.status, "disponivel");
  assert.equal(typeof corpo.dataDevolucaoEfetiva, "string");
  assert.ok(Number.isFinite(Date.parse(corpo.dataDevolucaoEfetiva)));
  assert.equal(estado.veiculoStatus, "disponivel");
});

test("devolução preserva manutenção definida por ADMIN durante locação ativa", async (t) => {
  autenticarUsuarioAtivo(t);
  const locacao = { id: 42, usuarioId: 11, veiculoId: 7, status: "ATIVA" };
  let statusVeiculo = "manutencao";

  substituirTemporariamente(
    prisma.locacao,
    "findUnique",
    async () => ({
      ...locacao,
      veiculo: { id: 7, status: statusVeiculo },
    }),
    t,
  );
  substituirTemporariamente(
    prisma,
    "$transaction",
    async (operacao) =>
      operacao({
        locacao: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            ...locacao,
            status: "FINALIZADA",
            veiculo: { id: 7, status: statusVeiculo },
          }),
        },
        veiculo: {
          updateMany: async ({ where, data }) => {
            assert.deepEqual(where, {
              id: 7,
              status: { in: ["alugado", "reservado"] },
            });
            if (["alugado", "reservado"].includes(statusVeiculo)) {
              statusVeiculo = data.status;
              return { count: 1 };
            }
            return { count: 0 };
          },
        },
      }),
    t,
  );

  const { url, headers } = await iniciarServidor(t);
  const resposta = await fetch(url, { method: "PATCH", headers });
  const corpo = await resposta.json();

  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "FINALIZADA");
  assert.equal(corpo.veiculo.status, "manutencao");
  assert.equal(statusVeiculo, "manutencao");
});

test("retorna 409 se a locação já estiver finalizada", async (t) => {
  autenticarUsuarioAtivo(t);
  substituirTemporariamente(
    prisma.locacao,
    "findUnique",
    async () => ({
      id: 42,
      usuarioId: 11,
      veiculoId: 7,
      status: "FINALIZADA",
      dataDevolucaoEfetiva: new Date(),
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
      throw new Error("A transação não deveria ser iniciada");
    },
    t,
  );

  const { url, headers } = await iniciarServidor(t);
  const resposta = await fetch(url, { method: "PATCH", headers });

  assert.equal(resposta.status, 409);
  assert.deepEqual(await resposta.json(), { erro: "Locação já finalizada" });
  assert.equal(transacoes, 0);
});

test("retorna 409 e não libera veículo se a atualização condicional perder a corrida", async (t) => {
  autenticarUsuarioAtivo(t);
  substituirTemporariamente(
    prisma.locacao,
    "findUnique",
    async () => ({
      id: 42,
      usuarioId: 11,
      veiculoId: 7,
      status: "ATIVA",
      veiculo: { id: 7, status: "alugado" },
    }),
    t,
  );

  let atualizacoesVeiculo = 0;
  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    writable: true,
    value: async (operacao) =>
      operacao({
        locacao: {
          updateMany: async ({ where }) => {
            assert.deepEqual(where, { id: 42, status: "ATIVA" });
            return { count: 0 };
          },
        },
        veiculo: {
          updateMany: async () => {
            atualizacoesVeiculo += 1;
          },
        },
      }),
  });
  t.after(() => {
    delete prisma.$transaction;
  });

  const { url, headers } = await iniciarServidor(t);
  const resposta = await fetch(url, { method: "PATCH", headers });

  assert.equal(resposta.status, 409);
  assert.deepEqual(await resposta.json(), { erro: "Locação já finalizada" });
  assert.equal(atualizacoesVeiculo, 0);
});
