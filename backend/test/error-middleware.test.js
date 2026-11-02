const test = require("node:test");
const assert = require("node:assert/strict");
const { tratarErros } = require("../src/middlewares/error.middleware");

function respostaFalsa() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("P2034 retorna conflito HTTP 409 em vez de erro interno", () => {
  const res = respostaFalsa();
  tratarErros({ code: "P2034" }, {}, res, () => {});
  assert.equal(res.statusCode, 409);
  assert.match(res.body.erro, /Conflito de concorrência/);
});
