const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularValorTotal } = require('../src/services/locacao.service');

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const inicio = new Date('2026-11-01T10:00:00.000Z');

function valorPara(duracaoMs, diaria = 120) {
  return calcularValorTotal(diaria, inicio, new Date(inicio.getTime() + duracaoMs));
}

test('qualquer duração positiva menor que 24 horas cobra uma diária', () => {
  assert.equal(valorPara(1), 120);
  assert.equal(valorPara(12 * HORA), 120);
  assert.equal(valorPara(DIA - 1), 120);
});

test('24 horas exatas cobram uma diária; qualquer fração adicional inicia outra', () => {
  assert.equal(valorPara(DIA), 120);
  assert.equal(valorPara(DIA + 1), 240);
  assert.equal(valorPara(47 * HORA + 59 * 60 * 1000), 240);
  assert.equal(valorPara(2 * DIA), 240);
  assert.equal(valorPara(2 * DIA + 1), 360);
});

test('mantém o valor monetário em centavos ao multiplicar diárias', () => {
  assert.equal(valorPara(3 * DIA, 99.9), 299.7);
  assert.equal(valorPara(DIA + 1, 199.95), 399.9);
});
