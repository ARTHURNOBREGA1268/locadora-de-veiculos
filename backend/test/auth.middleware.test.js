const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const autenticar = require('../src/middlewares/auth.middleware');
const { getJwtSecret } = require('../src/lib/jwtConfig');

const SECRET = 'test-secret-that-is-long-enough-123456';

test.beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});

test('rejects a missing JWT secret', () => {
  delete process.env.JWT_SECRET;
  assert.throws(() => getJwtSecret(), /JWT_SECRET deve ter pelo menos 32 caracteres/);
});

test('rejects a short JWT secret', () => {
  process.env.JWT_SECRET = 'short-secret';
  assert.throws(() => getJwtSecret(), /JWT_SECRET deve ter pelo menos 32 caracteres/);
});

test('accepts a sufficiently long JWT secret', () => {
  assert.equal(getJwtSecret(), SECRET);
});

test('accepts an HS256 token with a positive integer subject', () => {
  const token = jwt.sign({ sub: '42' }, SECRET, { algorithm: 'HS256' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  let nextCalled = false;

  autenticar(req, {}, () => {
    nextCalled = true;
  });

  assert.equal(req.userId, 42);
  assert.equal(nextCalled, true);
});

test('rejects a token without a subject', () => {
  const token = jwt.sign({ role: 'user' }, SECRET, { algorithm: 'HS256' });
  const req = { headers: { authorization: `Bearer ${token}` } };

  assert.throws(() => autenticar(req, {}, () => {}), error => error.status === 401);
});

test('rejects a non-positive or malformed subject', () => {
  for (const subject of ['0', '-1', '1.5', 'abc', '9007199254740992']) {
    const token = jwt.sign({ sub: subject }, SECRET, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } };

    assert.throws(() => autenticar(req, {}, () => {}), error => error.status === 401);
  }
});

test('rejects a token signed with an algorithm other than HS256', () => {
  const token = jwt.sign({ sub: '42' }, SECRET, { algorithm: 'HS384' });
  const req = { headers: { authorization: `Bearer ${token}` } };

  assert.throws(() => autenticar(req, {}, () => {}), error => error.status === 401);
});
