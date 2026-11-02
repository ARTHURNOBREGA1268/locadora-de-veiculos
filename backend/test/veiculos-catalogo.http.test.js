const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret-for-vehicle-catalog-authorization-123456";

const prisma = require("../src/lib/prisma");
const app = require("../src/app");
const service = require("../src/services/veiculo.service");

function substituir(alvo, chave, valor, t) {
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
    subject: "77",
    algorithm: "HS256",
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

async function requisitar(base, headers, path, { method = "GET", body } = {}) {
  const resposta = await fetch(`${base}${path}`, {
    method,
    headers:
      body === undefined
        ? headers
        : { ...headers, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { resposta, dados: await resposta.json() };
}

test("DTO público de veículo não expõe identificação sigilosa, documentação ou dados financeiros", () => {
  const resultado = service.publicDto({
    id: 5,
    placa: "ABC1D23",
    marca: "Toyota",
    modelo: "Corolla",
    anoFabricacao: 2024,
    anoModelo: 2024,
    status: "disponivel",
    valorDiaria: "200.00",
    renavam: "12345678901",
    chassi: "9BWZZZ377VT004251",
    dataCompra: new Date("2024-01-01"),
    valorCompra: "100000.00",
    valorFipe: "110000.00",
    valorRevendaEstimado: "70000.00",
    formaAquisicao: "financiado",
    crlvVencimento: new Date("2027-01-01"),
    apoliceNumero: "SEG-123",
    apoliceFranquia: "5000.00",
  });

  assert.equal(resultado.id, 5);
  assert.equal(resultado.status, "disponivel");
  for (const campo of [
    "valorDiaria",
    "renavam",
    "chassi",
    "dataCompra",
    "valorCompra",
    "valorFipe",
    "valorRevendaEstimado",
    "formaAquisicao",
    "crlvVencimento",
    "apoliceNumero",
    "apoliceFranquia",
  ])
    assert.equal(
      Object.hasOwn(resultado, campo),
      false,
      `${campo} não deve ser público`,
    );
});

test("validação do veículo rejeita placa, RENAVAM, chassi, ano e enum inválidos antes de gravar", async () => {
  const base = {
    placa: "ABC1D23",
    marca: "Toyota",
    modelo: "Corolla",
    anoFabricacao: 2024,
    anoModelo: 2024,
  };
  const casos = [
    [{ ...base, placa: "??" }, /placa inválida/],
    [{ ...base, renavam: "12345" }, /renavam deve conter 11 dígitos/],
    [
      { ...base, chassi: "I1O00000000000000" },
      /chassi deve conter 17 caracteres válidos/,
    ],
    [{ ...base, anoFabricacao: 1800 }, /anoFabricacao inválido/],
    [{ ...base, numPortas: 9 }, /numPortas inválido/],
    [{ ...base, valorCompra: 10000000000 }, /valorCompra inválido/],
    [
      { ...base, valorDiaria: 100 },
      /valorDiaria é gerido exclusivamente pela precificação/,
    ],
    [{ ...base, apoliceFranquia: 100000000 }, /apoliceFranquia inválido/],
    [
      { ...base, anoFabricacao: 2025, anoModelo: 2024 },
      /anoModelo não pode ser anterior/,
    ],
    [{ ...base, combustivel: "gas" }, /combustivel inválido/],
    [{ ...base, cambio: "semi-automatico" }, /cambio inválido/],
  ];

  for (const [dados, mensagem] of casos) {
    await assert.rejects(service.cleanVehicle(dados, false), mensagem);
  }
  const normalizado = await service.cleanVehicle(
    { chassi: "9bwzzz377vt004251" },
    true,
  );
  assert.equal(normalizado.chassi, "9BWZZZ377VT004251");
});

test("opcionais são vinculados pela relação de junção nos fluxos de criação e edição", async () => {
  const base = {
    placa: "ABC1D23",
    marca: "Toyota",
    modelo: "Corolla",
    anoFabricacao: 2024,
    anoModelo: 2024,
    categoriaId: 1,
    filialId: 1,
  };
  const criacao = await service.cleanVehicle(
    { ...base, opcionais: [3, "5", 3] },
    false,
  );
  assert.deepEqual(criacao.opcionais, {
    create: [
      { opcional: { connect: { id: 3 } } },
      { opcional: { connect: { id: 5 } } },
    ],
  });

  const edicao = await service.cleanVehicle({ opcionais: [5] }, true);
  assert.deepEqual(edicao.opcionais, {
    deleteMany: {},
    create: [{ opcional: { connect: { id: 5 } } }],
  });
});

test("ADMIN não consegue marcar disponível veículo com locação ativa", async (t) => {
  substituir(prisma.veiculo, "findUnique", async () => ({ id: 5 }), t);
  substituir(prisma.locacao, "findFirst", async () => ({ id: 42 }), t);
  let iniciouTransacao = false;
  substituir(
    prisma,
    "$transaction",
    async () => {
      iniciouTransacao = true;
    },
    t,
  );

  await assert.rejects(service.editar(5, { status: "disponivel" }), {
    status: 409,
    message: /locação ativa/,
  });
  assert.equal(iniciouTransacao, false);
});

test("corrida de reserva impede update administrativo de reabrir veículo alugado", async (t) => {
  substituir(prisma.veiculo, "findUnique", async () => ({ id: 5 }), t);
  substituir(prisma.locacao, "findFirst", async () => null, t);
  substituir(
    prisma,
    "$transaction",
    async (operacao) =>
      operacao({ veiculo: { updateMany: async () => ({ count: 0 }) } }),
    t,
  );

  await assert.rejects(service.editar(5, { status: "disponivel" }), {
    status: 409,
    message: /status do veículo mudou/,
  });
});

test("USER consulta somente lista pública; detalhe e histórico exigem ADMIN; histórico valida veículo da locação", async (t) => {
  let papelAtual = "USER";
  let consultasDetalhe = 0;
  let consultasHistorico = 0;
  let consultasLocacoes = 0;
  let criacoesManutencao = 0;
  let dadosManutencaoCriada;
  const veiculo = {
    id: 5,
    placa: "ABC1D23",
    marca: "Toyota",
    modelo: "Corolla",
    anoFabricacao: 2024,
    anoModelo: 2024,
    status: "disponivel",
    valorDiaria: "200.00",
    renavam: "12345678901",
    chassi: "9BWZZZ377VT004251",
    valorCompra: "100000.00",
    categoria: { id: 1, nome: "Sedan" },
    filial: { id: 1, nome: "Matriz" },
    opcionais: [],
  };

  substituir(
    prisma.usuario,
    "findUnique",
    async () => ({ ativo: true, papel: papelAtual, tokenVersion: 0 }),
    t,
  );
  substituir(prisma.veiculo, "findMany", async () => [veiculo], t);
  substituir(
    prisma.locacao,
    "findMany",
    async ({ where }) => {
      consultasLocacoes += 1;
      assert.deepEqual(where, { veiculoId: 5 });
      return [
        {
          id: 31,
          dataInicio: new Date("2026-11-02T12:00:00.000Z"),
          dataPrevistaDevolucao: new Date("2026-11-04T12:00:00.000Z"),
          status: "reservada",
        },
      ];
    },
    t,
  );
  substituir(
    prisma.veiculo,
    "findUnique",
    async () => {
      consultasDetalhe += 1;
      return veiculo;
    },
    t,
  );
  for (const delegate of [
    prisma.manutencao,
    prisma.sinistroAvaria,
    prisma.multa,
    prisma.vistoria,
  ]) {
    substituir(
      delegate,
      "findMany",
      async () => {
        consultasHistorico += 1;
        return [];
      },
      t,
    );
  }
  substituir(
    prisma.manutencao,
    "create",
    async ({ data }) => {
      criacoesManutencao += 1;
      dadosManutencaoCriada = data;
      return { id: 10, ...data, createdAt: new Date(), updatedAt: new Date() };
    },
    t,
  );
  substituir(prisma.locacao, "findUnique", async () => ({ veiculoId: 9 }), t);
  substituir(
    prisma,
    "$transaction",
    async (operacao) =>
      operacao({
        locacao: { findUnique: async () => ({ veiculoId: 9 }) },
      }),
    t,
  );

  const { base, headers } = await iniciarServidor(t);

  const lista = await requisitar(base, headers, "/veiculos");
  assert.equal(lista.resposta.status, 200);
  assert.equal(lista.dados.length, 1);
  assert.equal(Object.hasOwn(lista.dados[0], "renavam"), false);
  assert.equal(Object.hasOwn(lista.dados[0], "chassi"), false);
  assert.equal(Object.hasOwn(lista.dados[0], "valorCompra"), false);

  const detalheUser = await requisitar(base, headers, "/veiculos/5");
  const historicoUser = await requisitar(
    base,
    headers,
    "/veiculos/5/historico",
  );
  const locacoesUser = await requisitar(base, headers, "/veiculos/5/locacoes");
  assert.equal(detalheUser.resposta.status, 403);
  assert.equal(historicoUser.resposta.status, 403);
  assert.equal(locacoesUser.resposta.status, 403);
  assert.equal(
    consultasDetalhe,
    0,
    "USER não deve chegar ao service de detalhe",
  );
  assert.equal(consultasHistorico, 0, "USER não deve consultar histórico");
  assert.equal(
    consultasLocacoes,
    0,
    "USER não deve consultar locações do veículo",
  );

  papelAtual = "ADMIN";
  const detalheAdmin = await requisitar(base, headers, "/veiculos/5");
  assert.equal(detalheAdmin.resposta.status, 200);
  assert.equal(detalheAdmin.dados.renavam, veiculo.renavam);
  const locacoesAdmin = await requisitar(base, headers, "/veiculos/5/locacoes");
  assert.equal(locacoesAdmin.resposta.status, 200);
  assert.equal(locacoesAdmin.dados.length, 1);
  assert.equal(locacoesAdmin.dados[0].id, 31);
  assert.equal(locacoesAdmin.dados[0].status, "reservada");
  assert.equal(consultasLocacoes, 1);

  const historicoAdmin = await requisitar(
    base,
    headers,
    "/veiculos/5/historico",
  );
  assert.equal(historicoAdmin.resposta.status, 200);
  assert.deepEqual(
    Object.keys(historicoAdmin.dados).sort(),
    ["manutencoes", "multas", "sinistros", "vistorias"].sort(),
  );
  assert.equal(consultasHistorico, 4);

  const novaManutencao = await requisitar(
    base,
    headers,
    "/veiculos/5/manutencoes",
    {
      method: "POST",
      body: {
        data: "2026-11-01",
        tipo: "Revisão",
        descricao: "Troca de óleo",
        valor: 350,
        km: 50000,
      },
    },
  );
  assert.equal(novaManutencao.resposta.status, 201);
  assert.equal(criacoesManutencao, 1);
  assert.deepEqual(dadosManutencaoCriada.veiculo, { connect: { id: 5 } });
  assert.equal(Object.hasOwn(dadosManutencaoCriada, "veiculoId"), false);

  const multaLocacaoAlheia = await requisitar(
    base,
    headers,
    "/veiculos/5/multas",
    {
      method: "POST",
      body: {
        data: "2026-11-01T12:00:00.000Z",
        infracao: "Estacionamento",
        valor: 120,
        locacaoId: 31,
      },
    },
  );
  assert.equal(multaLocacaoAlheia.resposta.status, 400);
  assert.match(multaLocacaoAlheia.dados.erro, /não pertence ao veículo/);
});

test("multa durante a retirada real vincula locação e cria cobrança pendente com taxa", async (t) => {
  const locacao = {
    id: 31,
    veiculoId: 5,
    status: "finalizada",
    dataInicio: new Date("2026-11-02T12:00:00.000Z"),
    dataPrevistaDevolucao: new Date("2026-11-04T12:00:00.000Z"),
    retiradaReal: new Date("2026-11-02T10:00:00.000Z"),
    dataDevolucaoEfetiva: new Date("2026-11-03T10:00:00.000Z"),
  };
  let cobrancaCriada;
  let pagamentoCriado;
  let atualizacaoLocacao;
  const tx = {
    locacao: {
      findMany: async () => [locacao],
      findUnique: async () => ({ valorFinalCobrado: "100.00" }),
      update: async ({ data }) => {
        atualizacaoLocacao = data;
        return { id: locacao.id, ...data };
      },
    },
    multa: {
      create: async ({ data }) => ({ id: 91, locacaoId: locacao.id, ...data }),
    },
    configuracaoPrecificacao: {
      findUnique: async () => ({ taxaAdminMultaTransito: "12.50" }),
    },
    locacaoCobrancaExtra: {
      create: async ({ data }) => {
        cobrancaCriada = data;
        return { id: 101, ...data };
      },
    },
    locacaoPagamento: {
      create: async ({ data }) => {
        pagamentoCriado = data;
        return { id: 111, ...data };
      },
    },
  };
  substituir(
    prisma.usuario,
    "findUnique",
    async () => ({ ativo: true, papel: "ADMIN", tokenVersion: 0 }),
    t,
  );
  substituir(prisma.veiculo, "findUnique", async () => ({ id: 5 }), t);
  substituir(prisma, "$transaction", async (operacao) => operacao(tx), t);

  const { base, headers } = await iniciarServidor(t);
  const resposta = await requisitar(base, headers, "/veiculos/5/multas", {
    method: "POST",
    body: {
      data: "2026-11-02T11:00:00.000Z",
      infracao: "Estacionamento irregular",
      valor: 130,
      status: "pendente",
    },
  });

  assert.equal(resposta.resposta.status, 201);
  assert.equal(resposta.dados.locacaoId, 31);
  assert.equal(cobrancaCriada.locacaoId, 31);
  assert.equal(cobrancaCriada.multaId, 91);
  assert.equal(cobrancaCriada.tipo, "multa_transito");
  assert.equal(cobrancaCriada.valor.toFixed(2), "142.50");
  assert.equal(pagamentoCriado.status, "pendente");
  assert.equal(pagamentoCriado.valor.toFixed(2), "142.50");
  assert.equal(atualizacaoLocacao.valorFinalCobrado.toFixed(2), "242.50");
});
