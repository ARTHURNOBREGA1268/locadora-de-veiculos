const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret-for-rental-finalization-123456";
process.env.CORS_ORIGIN = "http://localhost:5173";

const prisma = require("../src/lib/prisma");
const app = require("../src/app");

const CONFIG = {
  id: 1,
  exigeVistoriaSaida: true,
  exigeVistoriaEntrada: true,
  kmLivre: true,
  kmFranquiaDiaria: null,
  politicaCombustivel: "mesmo_nivel",
  toleranciaAtrasoMinutos: 30,
  cancelamentoPrazoHoras: 24,
  cancelamentoMultaPercentual: 0,
};
const PRECOS = {
  valorKmExcedente: 0,
  taxaReposicaoCombustivel: 0,
  atrasoToleranciaMinutos: 30,
  atrasoValorHoraPercentual: 0,
  atrasoLimiteHorasViraDiaria: 0,
};

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

function comCliente(locacao) {
  return {
    ...locacao,
    cliente: { id: locacao.clienteId || 18, usuarioId: locacao.usuarioId ?? 11 },
  };
}

function locacaoBase(status) {
  return {
    id: 42,
    usuarioId: 11,
    clienteId: 18,
    veiculoId: 7,
    status,
    dataInicio: new Date(Date.now() - 86_400_000),
    dataPrevistaDevolucao: new Date(Date.now() + 86_400_000),
    dataDevolucaoEfetiva: null,
    kmSaida: null,
    kmEntrada: null,
    combustivelSaida: null,
    combustivelEntrada: null,
    valorTotal: 250,
  };
}

function criarTx(locacao, veiculo, { corrida = false, onAtualizarVeiculo = () => {}, onVistoria = () => {}, onCobranca = () => {}, onPagamento = () => {} } = {}) {
  return {
    configuracaoLocacao: { upsert: async () => ({ ...CONFIG }) },
    configuracaoPrecificacao: { upsert: async () => ({ ...PRECOS }) },
    locacaoStatusHistorico: { create: async ({ data }) => ({ id: 90, ...data }) },
    locacaoCobrancaExtra: {
      create: async ({ data }) => { onCobranca(data); return { id: 91, ...data }; },
      aggregate: async () => ({ _sum: { valor: 0 } }),
    },
    locacaoPagamento: { create: async ({ data }) => { onPagamento(data); return { id: 92, ...data }; } },
    vistoria: { create: async ({ data }) => { onVistoria(data); return { id: 93, ...data }; } },
    locacao: {
      findUnique: async () => ({
        ...comCliente(locacao),
        preco: { valorDiariaAplicada: 125 },
        veiculo: { id: veiculo.id, status: veiculo.status },
      }),
      findFirst: async () => null,
      updateMany: async ({ where, data }) => {
        assert.equal(where.id, locacao.id);
        if (where.status !== undefined) {
          assert.equal(where.status, locacao.status);
          if (corrida) return { count: 0 };
        }
        if (where.contratoAssinado === false && locacao.contratoAssinado) return { count: 0 };
        Object.assign(locacao, data);
        return { count: 1 };
      },
      update: async ({ data }) => Object.assign(locacao, data),
    },
    veiculo: {
      findUnique: async () => ({ id: veiculo.id, kmAtual: veiculo.kmAtual }),
      update: async ({ data }) => Object.assign(veiculo, data),
      updateMany: async ({ where, data }) => {
        onAtualizarVeiculo();
        const statusAtual = veiculo.status;
        const statusEsperado = typeof where.status === "string"
          ? statusAtual === where.status
          : where.status?.in?.includes(statusAtual);
        if (!statusEsperado) return { count: 0 };
        Object.assign(veiculo, data);
        return { count: 1 };
      },
    },
  };
}

function prepararHttp(t, locacao, veiculo, opcoesTx = {}) {
  substituirTemporariamente(
    prisma.usuario,
    "findUnique",
    async () => ({ ativo: true, papel: opcoesTx.userRole || "USER", tokenVersion: 0 }),
    t,
  );
  substituirTemporariamente(
    prisma.checklistItem,
    "findMany",
    async () => opcoesTx.checklistItens || [],
    t,
  );
  substituirTemporariamente(
    prisma.configuracaoLocacao,
    "upsert",
    async () => ({ ...CONFIG }),
    t,
  );
  substituirTemporariamente(
    prisma.locacao,
    "findUnique",
    async () => ({
      ...comCliente(locacao),
      veiculo: { id: veiculo.id, status: veiculo.status },
    }),
    t,
  );
  substituirTemporariamente(
    prisma,
    "$transaction",
    async (operacao) => operacao(criarTx(locacao, veiculo, opcoesTx)),
    t,
  );

  const server = app.listen(0, "127.0.0.1");
  return new Promise((resolve) => {
    server.once("listening", () => {
      t.after(() => new Promise((done) => {
        server.closeAllConnections();
        server.close(done);
      }));
      const token = jwt.sign({}, process.env.JWT_SECRET, {
        subject: "11",
        algorithm: "HS256",
      });
      resolve({
        url: `http://127.0.0.1:${server.address().port}/locacoes/${locacao.id}`,
        baseUrl: `http://127.0.0.1:${server.address().port}/locacoes`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });
}

async function patch(url, headers, action, body) {
  const requestHeaders = body === undefined
    ? headers
    : { ...headers, "Content-Type": "application/json" };
  return fetch(`${url}/${action}`, {
    method: "PATCH",
    headers: requestHeaders,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const vistoriaValida = { km: 200, nivelCombustivel: 70 };

test("checklist autenticado lista itens ativos e a vistoria congela respostas obrigatórias", async (t) => {
  const checklistItens = [
    { id: 3, descricao: "Pneus", obrigatorio: true, ordem: 1 },
    { id: 4, descricao: "Triângulo", obrigatorio: false, ordem: 2 },
  ];
  const locacao = locacaoBase("reservada");
  const veiculo = { id: 7, status: "reservado", kmAtual: 100 };
  let vistoriaCriada;
  const { url, baseUrl, headers } = await prepararHttp(t, locacao, veiculo, {
    checklistItens,
    onVistoria: (data) => { vistoriaCriada = data; },
  });

  const respostaChecklist = await fetch(`${baseUrl}/checklist`, { headers });
  assert.equal(respostaChecklist.status, 200);
  assert.deepEqual(await respostaChecklist.json(), checklistItens);

  const semItemObrigatorio = await patch(url, headers, "retirar", { vistoria: vistoriaValida });
  assert.equal(semItemObrigatorio.status, 400);

  const resposta = await patch(url, headers, "retirar", {
    vistoria: {
      ...vistoriaValida,
      itensChecklist: [
        { itemId: 3, conforme: true },
        { itemId: 4, conforme: false },
      ],
    },
  });
  assert.equal(resposta.status, 200);
  assert.deepEqual(vistoriaCriada.itensChecklist, [
    { itemId: 3, descricao: "Pneus", obrigatorio: true, conforme: true, observacoes: null },
    { itemId: 4, descricao: "Triângulo", obrigatorio: false, conforme: false, observacoes: null },
  ]);
});

test("USER não pode registrar cobrança extra nem assinatura de contrato", async (t) => {
  const locacao = locacaoBase("devolvida");
  const veiculo = { id: 7, status: "disponivel", kmAtual: 200 };
  const { baseUrl, headers } = await prepararHttp(t, locacao, veiculo);
  const cobranca = await fetch(`${baseUrl}/42/cobrancas-extras`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ tipo: "avaria", descricao: "Risco na porta", valor: "45.90" }),
  });
  const assinatura = await fetch(`${baseUrl}/42/contrato-assinado`, { method: "PATCH", headers });
  assert.equal(cobranca.status, 403);
  assert.equal(assinatura.status, 403);
});

test("ADMIN registra cobrança extra como saldo pendente e confirma assinatura do snapshot", async (t) => {
  const locacao = { ...locacaoBase("devolvida"), contratoTexto: "Contrato congelado", contratoAssinado: false };
  const veiculo = { id: 7, status: "disponivel", kmAtual: 200 };
  let cobrancaCriada;
  let pagamentoCriado;
  const { baseUrl, headers } = await prepararHttp(t, locacao, veiculo, {
    userRole: "ADMIN",
    onCobranca: (data) => { cobrancaCriada = data; },
    onPagamento: (data) => { pagamentoCriado = data; },
  });
  const cobranca = await fetch(`${baseUrl}/42/cobrancas-extras`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ tipo: "avaria", descricao: "Risco na porta", valor: "45.90" }),
  });
  assert.equal(cobranca.status, 201);
  assert.equal(cobrancaCriada.tipo, "avaria");
  assert.equal(Number(cobrancaCriada.valor), 45.9);
  assert.deepEqual(pagamentoCriado, { locacaoId: 42, tipo: "saldo", valor: cobrancaCriada.valor, status: "pendente" });

  const assinatura = await fetch(`${baseUrl}/42/contrato-assinado`, { method: "PATCH", headers });
  assert.equal(assinatura.status, 200);
  assert.equal(locacao.contratoAssinado, true);
  assert.ok(locacao.contratoAssinadoEm instanceof Date);
});

test("devolução registra horário/vistoria e libera o veículo", async (t) => {
  const locacao = locacaoBase("em_andamento");
  const veiculo = { id: 7, status: "alugado", kmAtual: 100 };
  const { url, headers } = await prepararHttp(t, locacao, veiculo);

  const resposta = await patch(url, headers, "devolver", { vistoria: vistoriaValida });
  const corpo = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "devolvida");
  assert.equal(corpo.veiculo.status, "disponivel");
  assert.equal(veiculo.kmAtual, vistoriaValida.km);
  assert.equal(locacao.kmEntrada, vistoriaValida.km);
  assert.equal(locacao.combustivelEntrada, vistoriaValida.nivelCombustivel);
  assert.ok(Number.isFinite(Date.parse(corpo.dataDevolucaoEfetiva)));
});

test("devolução não sobrescreve manutenção definida pelo ADMIN", async (t) => {
  const locacao = locacaoBase("em_andamento");
  const veiculo = { id: 7, status: "manutencao", kmAtual: 100 };
  const { url, headers } = await prepararHttp(t, locacao, veiculo);

  const resposta = await patch(url, headers, "devolver", { vistoria: vistoriaValida });
  const corpo = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "devolvida");
  assert.equal(corpo.veiculo.status, "manutencao");
  assert.equal(veiculo.status, "manutencao");
});

test("rejeita devolução repetida sem iniciar outra transação", async (t) => {
  const locacao = locacaoBase("finalizada");
  const veiculo = { id: 7, status: "disponivel", kmAtual: 200 };
  const { url, headers } = await prepararHttp(t, locacao, veiculo);
  let transacoes = 0;
  substituirTemporariamente(prisma, "$transaction", async () => {
    transacoes += 1;
    throw new Error("A transação não deveria iniciar");
  }, t);

  const resposta = await patch(url, headers, "devolver");
  assert.equal(resposta.status, 409);
  assert.match((await resposta.json()).erro, /Transição não permitida/);
  assert.equal(transacoes, 0);
});

test("corrida perdida não altera o status do veículo", async (t) => {
  const locacao = locacaoBase("em_andamento");
  const veiculo = { id: 7, status: "alugado", kmAtual: 100 };
  let atualizacoesStatusVeiculo = 0;
  const { url, headers } = await prepararHttp(t, locacao, veiculo, {
    corrida: true,
    onAtualizarVeiculo: () => { atualizacoesStatusVeiculo += 1; },
  });

  const resposta = await patch(url, headers, "devolver", { vistoria: vistoriaValida });
  assert.equal(resposta.status, 409);
  assert.deepEqual(await resposta.json(), {
    erro: "Estado da locação alterado por outra operação",
  });
  assert.equal(atualizacoesStatusVeiculo, 0);
  assert.equal(veiculo.status, "alugado");
});

test("finaliza apenas locação devolvida e não altera o estado do veículo", async (t) => {
  const locacao = locacaoBase("devolvida");
  const veiculo = { id: 7, status: "disponivel", kmAtual: 200 };
  const { url, headers } = await prepararHttp(t, locacao, veiculo);

  const resposta = await patch(url, headers, "finalizar");
  const corpo = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "finalizada");
  assert.equal(corpo.veiculo.status, "disponivel");
  assert.equal(veiculo.status, "disponivel");
  assert.equal(Number(locacao.valorFinalCobrado), locacao.valorTotal);
});

test("retirada registra vistoria e muda veículo para alugado", async (t) => {
  const locacao = locacaoBase("reservada");
  const veiculo = { id: 7, status: "reservado", kmAtual: 100 };
  const { url, headers } = await prepararHttp(t, locacao, veiculo);

  const resposta = await patch(url, headers, "retirar", { vistoria: vistoriaValida });
  const corpo = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "retirada");
  assert.equal(corpo.veiculo.status, "alugado");
  assert.equal(veiculo.status, "alugado");
  assert.equal(locacao.kmSaida, vistoriaValida.km);
  assert.equal(locacao.combustivelSaida, vistoriaValida.nivelCombustivel);
});
