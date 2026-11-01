const test = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../src/lib/prisma");
const { defaults, atualizar } = require("../src/services/configuracao.service");

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

test("itens de checklist omitidos na configuração são inativados, não excluídos", async (t) => {
  const atualizacoesChecklist = [];
  const tx = {
    filial: { count: async () => 0 },
    categoriaVeiculo: { count: async () => 0 },
    protecao: { count: async () => 0 },
    configuracaoLocacao: { upsert: async () => ({ id: 1 }) },
    configFilial: { deleteMany: async () => ({}), createMany: async () => ({}) },
    protecaoConfig: { deleteMany: async () => ({}), createMany: async () => ({}) },
    franquiaCategoria: { deleteMany: async () => ({}), createMany: async () => ({}) },
    caucaoCategoria: { deleteMany: async () => ({}), createMany: async () => ({}) },
    checklistItem: {
      count: async () => 1,
      updateMany: async (args) => {
        atualizacoesChecklist.push(args);
        return { count: 1 };
      },
      deleteMany: async () => {
        throw new Error("Checklist histórico não deve ser excluído fisicamente");
      },
      create: async () => ({ id: 4 }),
    },
  };

  substituirTemporariamente(prisma, "$transaction", async (operacao) => operacao(tx), t);
  substituirTemporariamente(prisma.configuracaoLocacao, "upsert", async () => ({ id: 1 }), t);
  substituirTemporariamente(
    prisma.configuracaoLocacao,
    "findUnique",
    async () => ({
      ...defaults,
      horarioRetiradaPadrao: new Date("1970-01-01T08:00:00.000Z"),
      horarioDevolucaoPadrao: new Date("1970-01-01T18:00:00.000Z"),
      documentosExigidos: [],
      filiais: [],
      protecoes: [],
      franquias: [],
      caucoes: [],
      checklist: [{ id: 3, descricao: "Pneus", obrigatorio: true, ordem: 1, ativo: true }],
    }),
    t,
  );
  substituirTemporariamente(prisma.filial, "findMany", async () => [], t);
  substituirTemporariamente(prisma.categoriaVeiculo, "findMany", async () => [], t);
  substituirTemporariamente(prisma.protecao, "findMany", async () => [], t);

  const payload = {
    ...defaults,
    filiaisRetirada: [],
    filiaisDevolucao: [],
    protecoes: [],
    franquiasCategoria: [],
    caucoesCategoria: [],
    checklistItens: [
      { id: 3, descricao: "Pneus", obrigatorio: true, ordem: 1, ativo: true },
    ],
  };

  await atualizar(payload);

  const inativacao = atualizacoesChecklist.find((x) => x.where.id?.notIn);
  assert.ok(inativacao, "deve identificar itens removidos da configuração");
  assert.deepEqual(inativacao.where.id.notIn, [3]);
  assert.deepEqual(inativacao.data, { ativo: false });
  assert.ok(
    atualizacoesChecklist.some((x) => x.where.id === 3),
    "o item que permanece deve continuar editável",
  );
});
