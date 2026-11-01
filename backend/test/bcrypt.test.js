const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

test('bcrypt gera hash e verifica credenciais corretas sem aceitar senha incorreta', async () => {
  const senha = 'senha-temporaria-de-teste';
  const senhaHash = await bcrypt.hash(senha, 4);

  assert.notEqual(senhaHash, senha);
  assert.equal(await bcrypt.compare(senha, senhaHash), true);
  assert.equal(await bcrypt.compare('outra-senha', senhaHash), false);
});
