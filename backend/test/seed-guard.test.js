const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

test("seed de demonstração recusa produção antes de conectar ao banco", () => {
  const seedPath = path.resolve(__dirname, "../prisma/seed.js");
  const resultado = spawnSync(process.execPath, [seedPath], {
    encoding: "utf8",
    timeout: 15000,
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: "mysql://demo:demo@127.0.0.1:1/locadora",
    },
  });
  const saida = `${resultado.stdout || ""}\n${resultado.stderr || ""}`;

  assert.equal(resultado.error, undefined, resultado.error?.message);
  assert.equal(resultado.status, 1, saida);
  assert.match(saida, /não pode ser executado em produção/i);
  assert.doesNotMatch(saida, /ECONNREFUSED|Can't reach database server/i);
});
