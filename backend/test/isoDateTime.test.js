const test = require('node:test');
const assert = require('node:assert/strict');
const { converterData } = require('../src/lib/isoDateTime');

test('converte timestamp UTC ISO válido', () => {
  const data = converterData('2030-02-28T10:30:45.123Z', 'Data de início');
  assert.equal(data.toISOString(), '2030-02-28T10:30:45.123Z');
});

test('converte timestamp ISO válido com offset', () => {
  const data = converterData('2030-02-28T10:30:45-05:00', 'Data de início');
  assert.equal(data.toISOString(), '2030-02-28T15:30:45.000Z');
});

test('aceita 29 de fevereiro em ano bissexto', () => {
  const data = converterData('2028-02-29T12:00:00Z', 'Data de início');
  assert.equal(data.toISOString(), '2028-02-29T12:00:00.000Z');
});

test('rejeita datas de calendário impossíveis', () => {
  for (const valor of [
    '2025-02-29T12:00:00Z',
    '2025-02-30T12:00:00Z',
    '2030-04-31T12:00:00Z',
    '2030-13-01T12:00:00Z',
    '2030-00-10T12:00:00Z'
  ]) {
    assert.throws(() => converterData(valor, 'Data de início'), erro => erro.status === 400);
  }
});

test('rejeita hora, minuto, segundo e offset fora do intervalo', () => {
  for (const valor of [
    '2030-01-01T24:00:00Z',
    '2030-01-01T12:60:00Z',
    '2030-01-01T12:00:60Z',
    '2030-01-01T12:00:00+24:00',
    '2030-01-01T12:00:00+02:60'
  ]) {
    assert.throws(() => converterData(valor, 'Data de início'), erro => erro.status === 400);
  }
});

test('rejeita datas locais, formatos ambíguos e valores que não sejam strings', () => {
  for (const valor of [
    '2030-01-01T12:00:00',
    '2030-01-01 12:00:00Z',
    '01/02/2030',
    1893499200000,
    new Date('2030-01-01T12:00:00Z')
  ]) {
    assert.throws(() => converterData(valor, 'Data de início'), erro => erro.status === 400);
  }
});

test('mantém mensagem de campo obrigatório para data ausente', () => {
  assert.throws(
    () => converterData('', 'Data prevista de devolução'),
    erro => erro.status === 400 && erro.message === 'Data prevista de devolução é obrigatória'
  );
});
