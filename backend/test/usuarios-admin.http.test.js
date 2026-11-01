const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-for-http-admin-authorization-123456';

const prisma = require('../src/lib/prisma');
const app = require('../src/app');

test('GET /usuarios exige usuário ADMIN atual no banco e retorna somente dados públicos', async t => {
  const delegate = prisma.usuario;
  const originais = {
    findUnique: delegate.findUnique,
    findMany: delegate.findMany
  };
  let papelAtual = 'USER';
  let argsListagem;
  delegate.findUnique = async ({ where }) => where.id === 42 ? { papel: papelAtual } : null;
  delegate.findMany = async args => {
    argsListagem = args;
    return [{ id: 2, nome: 'Admin', email: 'admin@example.test', papel: 'ADMIN', criadoEm: new Date('2026-01-02') }];
  };
  t.after(() => {
    if (originais.findUnique === undefined) delete delegate.findUnique;
    else delegate.findUnique = originais.findUnique;
    if (originais.findMany === undefined) delete delegate.findMany;
    else delegate.findMany = originais.findMany;
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  const url = `http://127.0.0.1:${server.address().port}/usuarios`;
  const token = jwt.sign({ sub: '42', papel: 'ADMIN' }, process.env.JWT_SECRET, { algorithm: 'HS256' });

  const semToken = await fetch(url);
  assert.equal(semToken.status, 401);

  const tokenUser = jwt.sign({ sub: '42', papel: 'ADMIN' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
  const proibido = await fetch(url, { headers: { Authorization: `Bearer ${tokenUser}` } });
  assert.equal(proibido.status, 403);

  papelAtual = 'ADMIN';
  const autorizado = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(autorizado.status, 200);
  const usuarios = await autorizado.json();
  assert.equal(usuarios.length, 1);
  assert.equal(usuarios[0].papel, 'ADMIN');
  assert.equal(Object.hasOwn(usuarios[0], 'senhaHash'), false);
  assert.deepEqual(argsListagem.orderBy, { criadoEm: 'desc' });
  assert.equal(argsListagem.select.senhaHash, undefined);
});

test('GET /usuarios retorna 401 se o usuário autenticado não existe no banco', async t => {
  const delegate = prisma.usuario;
  const original = delegate.findUnique;
  delegate.findUnique = async () => null;
  t.after(() => {
    if (original === undefined) delete delegate.findUnique;
    else delegate.findUnique = original;
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  const token = jwt.sign({ sub: '42' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
  const resposta = await fetch(`http://127.0.0.1:${server.address().port}/usuarios`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(resposta.status, 401);
});

test('registro público ignora papel ADMIN enviado pelo cliente', async t => {
  const delegate = prisma.usuario;
  const originais = { findUnique: delegate.findUnique, create: delegate.create };
  let dadosCriacao;
  delegate.findUnique = async () => null;
  delegate.create = async ({ data, select }) => {
    dadosCriacao = data;
    assert.equal(select.senhaHash, undefined);
    return { id: 3, nome: data.nome, email: data.email, papel: 'USER', criadoEm: new Date('2026-01-01') };
  };
  t.after(() => {
    if (originais.findUnique === undefined) delete delegate.findUnique;
    else delegate.findUnique = originais.findUnique;
    if (originais.create === undefined) delete delegate.create;
    else delegate.create = originais.create;
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  const resposta = await fetch(`http://127.0.0.1:${server.address().port}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Pessoa Teste', email: 'pessoa@example.test', senha: 'senha-segura', papel: 'ADMIN' })
  });
  assert.equal(resposta.status, 201);
  const usuario = await resposta.json();
  assert.equal(usuario.papel, 'USER');
  assert.equal(Object.hasOwn(usuario, 'senhaHash'), false);
  assert.equal(Object.hasOwn(dadosCriacao, 'papel'), false);
});
