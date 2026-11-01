const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET =
  "http-state-config-test-secret-abcdefghijklmnopqrstuvwxyz";
const prisma = require("../src/lib/prisma");
const app = require("../src/app");
async function servidor(t, role = "USER") {
  const original = prisma.usuario.findUnique;
  Object.defineProperty(prisma.usuario, "findUnique", {
    configurable: true,
    writable: true,
    value: async () => ({ ativo: true, papel: role, tokenVersion: 0 }),
  });
  t.after(() => {
    if (original === undefined) delete prisma.usuario.findUnique;
    else prisma.usuario.findUnique = original;
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }),
  );
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: "7",
    algorithm: "HS256",
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}
test("API bloqueia configuração para USER e rejeita transição locatícia fora de ordem", async (t) => {
  const original = prisma.locacao.findUnique;
  Object.defineProperty(prisma.locacao, "findUnique", {
    configurable: true,
    writable: true,
    value: async () => ({
      id: 8,
      usuarioId: 7,
      veiculoId: 9,
      status: "reservada",
      veiculo: { id: 9, status: "reservado" },
    }),
  });
  t.after(() => {
    if (original === undefined) delete prisma.locacao.findUnique;
    else prisma.locacao.findUnique = original;
  });
  const { base, headers } = await servidor(t);
  let r = await fetch(`${base}/configuracoes/locacao`, { headers });
  assert.equal(r.status, 403);
  r = await fetch(`${base}/locacoes/8/iniciar`, { method: "PATCH", headers });
  assert.equal(r.status, 409);
  assert.match((await r.json()).erro, /Transição não permitida/);
});
