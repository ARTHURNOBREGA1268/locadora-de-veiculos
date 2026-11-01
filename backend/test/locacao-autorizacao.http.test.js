const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-for-http-authorization-tests-123456';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
function autenticarUsuarioAtivo(t) {
  const delegate = prisma.usuario;
  const original = delegate.findUnique;
  Object.defineProperty(delegate, 'findUnique', { configurable: true, writable: true, value: async () => ({ ativo: true, papel: 'USER' }) });
  t.after(() => { if (original === undefined) delete delegate.findUnique; else delegate.findUnique = original; });
}

test('usuário autenticado não consegue consultar nem finalizar locação de outro usuário', async t => {
  autenticarUsuarioAtivo(t);
  const chamadasBanco = [];
  const delegate = prisma.locacao;
  Object.defineProperty(delegate, 'findUnique', {
    configurable: true,
    writable: true,
    value: async args => {
      chamadasBanco.push(args);
      return {
        id: args.where.id,
        usuarioId: 11,
        veiculoId: 7,
        status: 'ATIVA',
        veiculo: { id: 7, disponivel: false }
      };
    }
  });
  t.after(() => {
    delete delegate.findUnique;
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));

  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: '99',
    algorithm: 'HS256'
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/locacoes/42`;
  const headers = { Authorization: `Bearer ${token}` };

  const consulta = await fetch(baseUrl, { headers });
  assert.equal(consulta.status, 403);
  assert.deepEqual(await consulta.json(), { erro: 'Acesso negado a esta locação' });

  const finalizacao = await fetch(`${baseUrl}/finalizar`, {
    method: 'PATCH',
    headers
  });
  assert.equal(finalizacao.status, 403);
  assert.deepEqual(await finalizacao.json(), { erro: 'Acesso negado a esta locação' });

  assert.equal(chamadasBanco.length, 2);
  assert.deepEqual(chamadasBanco.map(chamada => chamada.where.id), [42, 42]);
});
