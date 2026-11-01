const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const autenticar = require('../src/middlewares/auth.middleware');
const { getJwtSecret } = require('../src/lib/jwtConfig');
const SECRET = 'test-secret-that-is-long-enough-123456';
test.beforeEach(() => { process.env.JWT_SECRET = SECRET; });
test('rejects missing or short JWT secret', () => {
  delete process.env.JWT_SECRET; assert.throws(() => getJwtSecret(), /JWT_SECRET deve ter pelo menos 32 caracteres/);
  process.env.JWT_SECRET = 'short-secret'; assert.throws(() => getJwtSecret(), /JWT_SECRET deve ter pelo menos 32 caracteres/);
});
test('loads current active role from DB and sets req.userRole', async t => {
  const old = prisma.usuario.findUnique;
  prisma.usuario.findUnique = async () => ({ ativo: true, papel: 'ADMIN' });
  t.after(() => { if (old === undefined) delete prisma.usuario.findUnique; else prisma.usuario.findUnique = old; });
  const req = { headers: { authorization: `Bearer ${jwt.sign({ sub: '42', papel: 'USER' }, SECRET)}` } };
  await new Promise((resolve, reject) => autenticar(req, {}, error => error ? reject(error) : resolve()));
  assert.equal(req.userId, 42); assert.equal(req.userRole, 'ADMIN');
});
test('rejects missing, malformed, wrong-algorithm JWTs and missing/inactive database users', async t => {
  const old = prisma.usuario.findUnique;
  t.after(() => { if (old === undefined) delete prisma.usuario.findUnique; else prisma.usuario.findUnique = old; });
  for (const subject of [undefined, '0', '-1', '1.5', 'abc', '9007199254740992']) {
    const token = jwt.sign(subject === undefined ? { role: 'user' } : { sub: subject }, SECRET);
    await assert.rejects(() => autenticar({ headers: { authorization: `Bearer ${token}` } }, {}, () => {}), e => e.status === 401);
  }
  const wrong = jwt.sign({ sub: '42' }, SECRET, { algorithm: 'HS384' });
  await assert.rejects(() => autenticar({ headers: { authorization: `Bearer ${wrong}` } }, {}, () => {}), e => e.status === 401);
  const token = jwt.sign({ sub: '42' }, SECRET);
  for (const record of [null, { ativo: false, papel: 'ADMIN' }]) {
    prisma.usuario.findUnique = async () => record;
    await assert.rejects(() => autenticar({ headers: { authorization: `Bearer ${token}` } }, {}, () => {}), e => e.status === 401);
  }
});
test('rejects missing bearer token', async () => {
  await assert.rejects(() => autenticar({ headers: {} }, {}, () => {}), e => e.status === 401);
});

test('rejects a previously issued token after session version changes', async t => {
  const old = prisma.usuario.findUnique;
  prisma.usuario.findUnique = async () => ({ ativo: true, papel: 'USER', tokenVersion: 1 });
  t.after(() => { if (old === undefined) delete prisma.usuario.findUnique; else prisma.usuario.findUnique = old; });

  const token = jwt.sign({ sub: '42', ver: 0 }, SECRET);
  await assert.rejects(
    () => autenticar({ headers: { authorization: `Bearer ${token}` } }, {}, () => {}),
    error => error.status === 401
  );
});
