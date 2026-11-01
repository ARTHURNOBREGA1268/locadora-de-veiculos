const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const clienteService = require('../src/services/cliente.service');

function substituir(alvo, chave, valor, t) {
  const original = Object.getOwnPropertyDescriptor(alvo, chave);
  Object.defineProperty(alvo, chave, { configurable: true, writable: true, value: valor });
  t.after(() => {
    if (original) Object.defineProperty(alvo, chave, original);
    else delete alvo[chave];
  });
}

function instalarTransacao(t, tx) {
  substituir(prisma, '$transaction', async (callback, opcoes) => {
    assert.equal(opcoes.isolationLevel, 'Serializable');
    return callback(tx);
  }, t);
}

test('não transfere o histórico de locações ao trocar a conta vinculada ao Cliente', async t => {
  let atualizacoes = 0;
  let consultaHistorico;
  substituir(prisma.usuario, 'findUnique', async ({ where }) => ({ id: where.id }), t);
  instalarTransacao(t, {
    cliente: {
      findUnique: async ({ where }) => ({ id: where.id, usuarioId: 7 }),
      update: async args => { atualizacoes += 1; return args.data; },
    },
    locacao: {
      findFirst: async args => {
        consultaHistorico = args;
        return { id: 900 };
      },
    },
  });

  await assert.rejects(
    () => clienteService.editar(40, { usuarioId: 8 }),
    error => error.status === 409 && /não pode ser alterado após a primeira locação/.test(error.message),
  );
  assert.deepEqual(consultaHistorico.where, { clienteId: 40 });
  assert.equal(atualizacoes, 0);
});

test('permite associar Cliente a uma conta antes de haver locações', async t => {
  let atualizacao;
  substituir(prisma.usuario, 'findUnique', async ({ where }) => ({ id: where.id }), t);
  instalarTransacao(t, {
    cliente: {
      findUnique: async ({ where }) => ({ id: where.id, usuarioId: null }),
      update: async args => { atualizacao = args; return { id: args.where.id, ...args.data }; },
    },
    locacao: { findFirst: async () => null },
  });

  const resultado = await clienteService.editar(41, { usuarioId: 8, nome: 'Cliente Teste' });
  assert.deepEqual(atualizacao.data, { usuarioId: 8, nome: 'Cliente Teste' });
  assert.equal(resultado.usuarioId, 8);
});
