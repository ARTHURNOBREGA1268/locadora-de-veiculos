const test = require("node:test");
const assert = require("node:assert/strict");
const { defaults, valida } = require("../src/services/configuracao.service");

function payload() {
  return {
    ...defaults,
    filiaisRetirada: [],
    filiaisDevolucao: [],
    protecoes: [],
    franquiasCategoria: [],
    caucoesCategoria: [],
    checklistItens: [],
  };
}

test("configuração valida defaults, tipos essenciais e enum de combustível", () => {
  const d = valida(payload());
  assert.equal(d.periodoMinimoDiarias, 1);
  assert.throws(
    () => valida({ ...payload(), politicaCombustivel: "invalido" }),
    /politicaCombustivel/,
  );
});

test("configuração rejeita mass assignment e faixas inválidas", () => {
  assert.throws(
    () => valida({ ...payload(), papel: "ADMIN" }),
    /não permitido/,
  );
  assert.throws(
    () => valida({ ...payload(), periodoMinimoDiarias: 256 }),
    /inválido/,
  );
  assert.throws(
    () => valida({ ...payload(), periodoMinimoDiarias: 31 }),
    /mínimo/,
  );
  assert.throws(
    () => valida({ ...payload(), raioEntregaKm: 65536 }),
    /inválido/,
  );
});

test("aceita criar proteção e checklist sem ID persistido", () => {
  const d = valida({
    ...payload(),
    protecoes: [
      {
        nome: "Proteção adicional",
        descricao: "Descrição informativa",
        ativo: true,
        selecionada: false,
      },
    ],
    checklistItens: [
      {
        descricao: "Conferir pneus",
        obrigatorio: true,
        ativo: true,
        ordem: 0,
      },
    ],
  });
  assert.equal(d.periodoMinimoDiarias, 1);
});

test("rejeita checklist inválido e proteção incompleta", () => {
  assert.throws(
    () =>
      valida({
        ...payload(),
        checklistItens: [
          {
            descricao: "x".repeat(121),
            obrigatorio: true,
            ativo: true,
            ordem: 0,
          },
        ],
      }),
    /Checklist inválido/,
  );
  assert.throws(
    () =>
      valida({
        ...payload(),
        protecoes: [
          { nome: "", descricao: "", ativo: true, selecionada: false },
        ],
      }),
    /Proteção inválida/,
  );
});

test("rejeita franquia ou caução fora de DECIMAL(10,2)", () => {
  assert.throws(
    () =>
      valida({
        ...payload(),
        franquiasCategoria: [{ categoriaId: 1, valor: 100000000 }],
      }),
    /Valores por categoria inválidos/,
  );
  assert.throws(
    () =>
      valida({
        ...payload(),
        caucoesCategoria: [{ categoriaId: 1, valor: 12.345 }],
      }),
    /Valores por categoria inválidos/,
  );
});
