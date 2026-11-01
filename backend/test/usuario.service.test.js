const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const prisma = require('../src/lib/prisma');
const usuarioService = require('../src/services/usuario.service');

function substituir(alvo, chave, valor, t) {
  const original = Object.getOwnPropertyDescriptor(alvo, chave);
  Object.defineProperty(alvo, chave, {
    configurable: true,
    writable: true,
    value: valor
  });
  t.after(() => {
    if (original) Object.defineProperty(alvo, chave, original);
    else delete alvo[chave];
  });
}

function transacaoFalsa(t, tx) {
  substituir(prisma, '$transaction', async (callback, opcoes) => {
    assert.equal(opcoes.isolationLevel, 'Serializable');
    return callback(tx);
  }, t);
}

test('cria conta USER por padrão, normaliza e-mail e nunca retorna o hash da senha', async t => {
  let argumentos;
  substituir(prisma.usuario, 'create', async args => {
    argumentos = args;
    return {
      id: 20,
      nome: args.data.nome,
      email: args.data.email,
      papel: args.data.papel,
      ativo: true,
      criadoEm: new Date('2026-01-01')
    };
  }, t);

  const criado = await usuarioService.criar({
    nome: '  Pessoa Nova  ',
    email: ' Pessoa@Example.Test ',
    senha: 'senha-segura-8'
  });

  assert.equal(criado.nome, 'Pessoa Nova');
  assert.equal(criado.email, 'pessoa@example.test');
  assert.equal(criado.papel, 'USER');
  assert.equal(criado.ativo, true);
  assert.equal(Object.hasOwn(criado, 'senhaHash'), false);
  assert.equal(await bcrypt.compare('senha-segura-8', argumentos.data.senhaHash), true);
  assert.equal(argumentos.select.senhaHash, undefined);
});

test('rejeita corpo incompleto e papel desconhecido antes de gravar', async t => {
  let criacoes = 0;
  substituir(prisma.usuario, 'create', async () => { criacoes += 1; }, t);

  await assert.rejects(() => usuarioService.criar({ nome: 'Pessoa', senha: 'senha-segura-8' }), error => error.status === 400);
  await assert.rejects(() => usuarioService.criar({ nome: 'Pessoa', email: 'pessoa@example.test', senha: 'senha-segura-8', papel: 'SUPERADMIN' }), error => error.status === 400);
  assert.equal(criacoes, 0);
});

test('inativação de USER incrementa a versão da sessão e mantém o perfil', async t => {
  let atualizacao;
  let locks = 0;
  transacaoFalsa(t, {
    $queryRaw: async () => { locks += 1; return []; },
    usuario: {
      findUnique: async () => ({ id: 20, nome: 'Pessoa', email: 'pessoa@example.test', papel: 'USER', ativo: true, criadoEm: new Date() }),
      count: async () => 0,
      update: async args => { atualizacao = args; return { ...args.data, id: 20 }; }
    }
  });

  const resultado = await usuarioService.editar(20, { ativo: false }, 99);
  assert.equal(locks, 1);
  assert.equal(atualizacao.data.ativo, false);
  assert.deepEqual(atualizacao.data.tokenVersion, { increment: 1 });
  assert.equal(resultado.ativo, false);
  assert.equal(Object.hasOwn(atualizacao.select, 'senhaHash'), false);
});

test('redefinir senha guarda apenas hash e revoga as sessões anteriores', async t => {
  let atualizacao;
  transacaoFalsa(t, {
    usuario: {
      findUnique: async () => ({ id: 20, nome: 'Pessoa', email: 'pessoa@example.test', papel: 'USER', ativo: true, criadoEm: new Date() }),
      update: async args => { atualizacao = args; return { id: 20, ativo: true, papel: 'USER' }; }
    }
  });

  await usuarioService.editar(20, { senha: 'senha-nova-123' }, 99);
  assert.deepEqual(atualizacao.data.tokenVersion, { increment: 1 });
  assert.equal(await bcrypt.compare('senha-nova-123', atualizacao.data.senhaHash), true);
  assert.equal(atualizacao.select.senhaHash, undefined);
});

test('não permite auto-rebaixar o próprio ADMIN nem remover o último ADMIN ativo', async t => {
  let atualizacoes = 0;
  const admin = { id: 7, nome: 'Admin', email: 'admin@example.test', papel: 'ADMIN', ativo: true, criadoEm: new Date() };
  const tx = {
    $queryRaw: async () => [admin],
    usuario: {
      findUnique: async () => admin,
      count: async () => 1,
      update: async () => { atualizacoes += 1; return admin; }
    }
  };
  transacaoFalsa(t, tx);

  await assert.rejects(() => usuarioService.editar(7, { papel: 'USER' }, 7), error => error.status === 409 && /própria conta/.test(error.message));
  await assert.rejects(() => usuarioService.editar(7, { ativo: false }, 99), error => error.status === 409 && /último ADMIN/.test(error.message));
  assert.equal(atualizacoes, 0);
});
