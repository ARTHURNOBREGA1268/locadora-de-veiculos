const test = require('node:test');
const assert = require('node:assert/strict');

process.env.CORS_ORIGIN = 'http://localhost:5173';
const app = require('../src/app');

test('CORS autoriza apenas origens configuradas', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));

  const url = `http://127.0.0.1:${server.address().port}/auth/me`;
  const origemPermitida = await fetch(url, {
    headers: { Origin: 'http://localhost:5173' }
  });
  assert.equal(origemPermitida.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const origemBloqueada = await fetch(url, {
    headers: { Origin: 'https://nao-autorizada.example' }
  });
  assert.equal(origemBloqueada.headers.get('access-control-allow-origin'), null);
});
