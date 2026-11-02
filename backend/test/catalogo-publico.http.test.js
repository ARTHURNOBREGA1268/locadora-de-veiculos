const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET ||= "catalog-public-http-test-secret-at-least-32";

const prisma = require("../src/lib/prisma");
const app = require("../src/app");

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
  return `http://127.0.0.1:${server.address().port}`;
}

async function requisitar(base, caminho) {
  const resposta = await fetch(`${base}${caminho}`);
  return { resposta, dados: await resposta.json() };
}

test("catálogo público lista somente veículos disponíveis e não expõe placa ou tarifa", async (t) => {
  let consulta;
  substituir(
    prisma.veiculo,
    "findMany",
    async (args) => {
      consulta = args;
      return [
        {
          id: 8,
          marca: "Toyota",
          modelo: "Corolla",
          versao: "XEi",
          anoFabricacao: 2024,
          anoModelo: 2025,
          cor: "prata",
          cambio: "automatico",
          combustivel: "flex",
          numPortas: 4,
          numPassageiros: 5,
          capacidadePortaMalas: 470,
          categoria: { id: 2, nome: "Executivo" },
        },
      ];
    },
    t,
  );

  const base = await iniciarServidor(t);
  const { resposta, dados } = await requisitar(base, "/catalogo/veiculos");
  assert.equal(resposta.status, 200);
  assert.deepEqual(consulta.where, { status: "disponivel" });
  assert.equal(consulta.select.placa, undefined);
  assert.equal(consulta.select.valorDiaria, undefined);
  assert.equal(dados.length, 1);
  assert.equal(dados[0].categoria.nome, "Executivo");
  assert.equal(Object.hasOwn(dados[0], "placa"), false);
  assert.equal(Object.hasOwn(dados[0], "valorDiaria"), false);
});

test("regras públicas são legíveis sem autenticação e excluem configuração interna", async (t) => {
  let consulta;
  substituir(
    prisma.configuracaoLocacao,
    "findUnique",
    async (args) => {
      consulta = args;
      return {
        periodoMinimoDiarias: 2,
        periodoMaximoDiarias: 21,
        horarioRetiradaPadrao: new Date("1970-01-01T08:30:00.000Z"),
        horarioDevolucaoPadrao: new Date("1970-01-01T08:30:00.000Z"),
        toleranciaAtrasoMinutos: 45,
        antecedenciaMinimaHoras: 4,
        antecedenciaMaximaDias: 180,
        cancelamentoPrazoHoras: 24,
        cancelamentoMultaPercentual: 15,
        idadeMinima: 21,
        tempoMinimoCnhMeses: 12,
        documentosExigidos: ["CNH válida"],
        exigeCartaoCredito: true,
        permiteMotoristaAdicional: true,
        maxMotoristasAdicionais: 2,
        kmLivre: false,
        kmFranquiaDiaria: 250,
        politicaCombustivel: "mesmo_nivel",
        permiteDevolucaoOutraFilial: true,
        permiteEntregaDomicilio: false,
        permiteRetiradaAeroporto: true,
        raioEntregaKm: null,
        protecaoBasicaInclusa: true,
        exigeVistoriaSaida: true,
        exigeVistoriaEntrada: true,
        modeloContrato: "CONTEÚDO INTERNO",
      };
    },
    t,
  );

  const base = await iniciarServidor(t);
  const { resposta, dados } = await requisitar(base, "/catalogo/regras");
  assert.equal(resposta.status, 200);
  assert.equal(consulta.select.modeloContrato, undefined);
  assert.equal(dados.periodoMinimoDiarias, 2);
  assert.equal(dados.horarioRetiradaPadrao, "08:30");
  assert.equal(dados.kmFranquiaDiaria, 250);
  assert.equal(dados.modeloContrato, undefined);
  assert.equal(dados.valorCompra, undefined);
});
