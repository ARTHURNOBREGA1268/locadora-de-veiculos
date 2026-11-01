const test = require('node:test');
const assert = require('node:assert/strict');
const { reservarVeiculo } = require('../src/services/locacao.service');

function criarTransacaoFalsa({ locacaoAtiva = null, disponivel = true } = {}) {
  const estado = { locacaoAtiva, disponivel, reservasConcluidas: 0 };
  const tx = {
    locacao: {
      findFirst: async () => estado.locacaoAtiva
    },
    veiculo: {
      updateMany: async ({ where, data }) => {
        if (where.id !== 7 || !where.disponivel || !estado.disponivel) {
          return { count: 0 };
        }
        estado.disponivel = data.disponivel;
        estado.reservasConcluidas += 1;
        return { count: 1 };
      }
    }
  };

  return { tx, estado };
}

test('recusa reservar veículo com locação ativa mesmo se disponivel estiver true', async () => {
  const { tx, estado } = criarTransacaoFalsa({
    locacaoAtiva: { id: 15, veiculoId: 7, status: 'ATIVA' }
  });

  await assert.rejects(
    reservarVeiculo(tx, 7),
    erro => erro.status === 409 && /locação ativa/.test(erro.message)
  );

  assert.equal(estado.reservasConcluidas, 0);
  assert.equal(estado.disponivel, true);
});

test('retorna conflito se a atualização condicional não reservar o veículo', async () => {
  const { tx, estado } = criarTransacaoFalsa({ disponivel: false });

  await assert.rejects(
    reservarVeiculo(tx, 7),
    erro => erro.status === 409 && /indisponível/.test(erro.message)
  );

  assert.equal(estado.reservasConcluidas, 0);
});

test('duas reservas concorrentes permitem somente uma atualização do veículo', async () => {
  const { tx, estado } = criarTransacaoFalsa();

  const resultados = await Promise.allSettled([
    reservarVeiculo(tx, 7),
    reservarVeiculo(tx, 7)
  ]);

  assert.equal(resultados.filter(resultado => resultado.status === 'fulfilled').length, 1);
  const recusadas = resultados.filter(resultado => resultado.status === 'rejected');
  assert.equal(recusadas.length, 1);
  assert.equal(recusadas[0].reason.status, 409);
  assert.equal(estado.reservasConcluidas, 1);
  assert.equal(estado.disponivel, false);
});
