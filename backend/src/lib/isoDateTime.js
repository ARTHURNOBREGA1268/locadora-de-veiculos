const AppError = require('./AppError');

const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,9}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i;

function converterData(valor, campo) {
  if (valor === undefined || valor === null || valor === '') {
    throw new AppError(`${campo} é obrigatória`, 400);
  }

  if (typeof valor !== 'string') {
    throw new AppError(`${campo} inválida`, 400);
  }

  const partes = valor.match(ISO_DATE_TIME);
  if (!partes) {
    throw new AppError(`${campo} inválida`, 400);
  }

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (ano < 1000 || mes < 1 || mes > 12) {
    throw new AppError(`${campo} inválida`, 400);
  }

  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (dia < 1 || dia > diasNoMes) {
    throw new AppError(`${campo} inválida`, 400);
  }

  const timestamp = Date.parse(valor);
  if (Number.isNaN(timestamp)) {
    throw new AppError(`${campo} inválida`, 400);
  }

  return new Date(timestamp);
}

module.exports = { converterData };
