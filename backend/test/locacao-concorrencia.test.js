const test = require("node:test");
const assert = require("node:assert/strict");
const {
  reservarVeiculo,
  transicoes,
} = require("../src/services/locacao.service");

function fake({ locacaoAtiva = null, status = "disponivel" } = {}) {
  const estado = { locacaoAtiva, status, reservasConcluidas: 0 };
  return {
    estado,
    tx: {
      locacao: {
        findFirst: async () => estado.locacaoAtiva,
      },
      veiculo: {
        updateMany: async ({ where, data }) => {
          if (
            where.id !== 7 ||
            where.status !== "disponivel" ||
            estado.status !== "disponivel"
          )
            return { count: 0 };
          estado.status = data.status;
          estado.reservasConcluidas += 1;
          return { count: 1 };
        },
      },
    },
  };
}

test("recusa reservar veículo que já possui locação ativa", async () => {
  const { tx, estado } = fake({ locacaoAtiva: { id: 15 } });
  await assert.rejects(
    reservarVeiculo(tx, 7),
    (erro) => erro.status === 409 && /locação ativa/.test(erro.message),
  );
  assert.equal(estado.reservasConcluidas, 0);
});

test("retorna conflito se o veículo não estiver disponível", async () => {
  const { tx, estado } = fake({ status: "inativo" });
  await assert.rejects(reservarVeiculo(tx, 7), (erro) => erro.status === 409);
  assert.equal(estado.reservasConcluidas, 0);
});

test("duas reservas concorrentes permitem somente uma atualização", async () => {
  const { tx, estado } = fake();
  const resultados = await Promise.allSettled([
    reservarVeiculo(tx, 7),
    reservarVeiculo(tx, 7),
  ]);
  assert.equal(
    resultados.filter((resultado) => resultado.status === "fulfilled").length,
    1,
  );
  assert.equal(estado.reservasConcluidas, 1);
  assert.equal(estado.status, "reservado");
});

test("veículo permanece reservado até a retirada", async () => {
  const { tx, estado } = fake();
  await reservarVeiculo(tx, 7, new Date(Date.now() + 86_400_000));
  assert.equal(estado.status, "reservado");
  const imediata = fake();
  await reservarVeiculo(imediata.tx, 7, new Date());
  assert.equal(imediata.estado.status, "reservado");
});

test("fluxo permitido exige etapas sequenciais e cancelamento antes da retirada", () => {
  assert.deepEqual(transicoes, {
    retirar: ["reservada", "retirada"],
    iniciar: ["retirada", "em_andamento"],
    devolver: ["em_andamento", "devolvida"],
    finalizar: ["devolvida", "finalizada"],
    cancelar: ["reservada", "cancelada"],
  });
});
