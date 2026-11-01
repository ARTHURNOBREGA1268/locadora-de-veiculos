const prisma = require('../lib/prisma');
const AppError = require('../lib/AppError');

const usuarioPublico = { id: true, nome: true, email: true, papel: true, ativo: true };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function falha(mensagem, status = 400) {
  throw new AppError(mensagem, status);
}

function validarId(valor, campo = 'id') {
  const texto = String(valor);
  const numero = Number(texto);
  if (!/^[1-9]\d*$/.test(texto) || !Number.isSafeInteger(numero)) falha(`${campo} inválido`);
  return numero;
}

function normalizarCpf(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string') falha('CPF inválido');
  const cpf = valor.replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) falha('CPF inválido');
  const digito = (base, pesoInicial) => {
    const soma = [...base].reduce((total, numero, indice) => total + Number(numero) * (pesoInicial - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  if (digito(cpf.slice(0, 9), 10) !== Number(cpf[9]) || digito(cpf.slice(0, 10), 11) !== Number(cpf[10])) falha('CPF inválido');
  return cpf;
}

function validarNome(valor) {
  if (typeof valor !== 'string' || valor.trim().length < 2 || valor.trim().length > 120) falha('Nome deve ter entre 2 e 120 caracteres');
  return valor.trim();
}

function normalizarEmail(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || valor.trim().length > 191 || !EMAIL_REGEX.test(valor.trim())) falha('E-mail de contato inválido');
  return valor.trim().toLowerCase();
}

function normalizarTelefone(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || valor.trim().length < 8 || valor.trim().length > 30 || !/^[+()\d\s.-]+$/.test(valor.trim())) falha('Telefone de contato inválido');
  return valor.trim();
}

function camposPermitidos(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) falha('Corpo inválido');
  const permitidos = new Set(['nome', 'cpf', 'email', 'telefone', 'usuarioId', 'ativo']);
  const desconhecidos = Object.keys(body).filter((chave) => !permitidos.has(chave));
  if (desconhecidos.length) falha(`Campos não permitidos: ${desconhecidos.join(', ')}`);
}

function tratarConflito(error) {
  if (error?.code === 'P2002') falha('CPF ou conta já vinculados a outro cliente', 409);
  throw error;
}

async function obterMeuPerfil(usuarioId) {
  const id = validarId(usuarioId, 'usuarioId');
  const cliente = await prisma.cliente.findUnique({
    where: { usuarioId: id },
    include: { usuario: { select: usuarioPublico } },
  });
  if (!cliente || !cliente.ativo) falha('Perfil de cliente não encontrado ou inativo', 404);
  return cliente;
}

async function listar(filtros = {}) {
  const where = {};
  if (filtros.busca !== undefined) {
    if (typeof filtros.busca !== 'string' || filtros.busca.length > 120) falha('Busca inválida');
    const busca = filtros.busca.trim();
    if (busca) {
      where.OR = [
        { nome: { contains: busca } },
        { cpf: { contains: busca.replace(/\D/g, '') } },
        { email: { contains: busca } },
        { telefone: { contains: busca } },
        { usuario: { is: { email: { contains: busca } } } },
      ];
    }
  }
  if (filtros.ativo !== undefined) {
    if (!['true', 'false'].includes(filtros.ativo)) falha('Filtro ativo inválido');
    where.ativo = filtros.ativo === 'true';
  }
  return prisma.cliente.findMany({
    where,
    include: { usuario: { select: usuarioPublico } },
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    take: 200,
  });
}

async function buscar(idEntrada) {
  const id = validarId(idEntrada);
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { usuario: { select: usuarioPublico } },
  });
  if (!cliente) falha('Cliente não encontrado', 404);
  return cliente;
}

async function verificarConta(usuarioId) {
  if (usuarioId === null || usuarioId === undefined || usuarioId === '') return null;
  const id = validarId(usuarioId, 'usuarioId');
  const usuario = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
  if (!usuario) falha('Usuário não encontrado', 404);
  return id;
}

async function criar(body = {}) {
  camposPermitidos(body);
  const nome = validarNome(body.nome);
  const cpf = normalizarCpf(body.cpf);
  const email = normalizarEmail(body.email);
  const telefone = normalizarTelefone(body.telefone);
  const usuarioId = await verificarConta(body.usuarioId);
  if (body.ativo !== undefined && typeof body.ativo !== 'boolean') falha('Ativo deve ser booleano');
  try {
    return await prisma.cliente.create({
      data: { nome, cpf, email, telefone, usuarioId, ativo: body.ativo ?? true },
      include: { usuario: { select: usuarioPublico } },
    });
  } catch (error) {
    tratarConflito(error);
  }
}

async function editar(idEntrada, body = {}) {
  camposPermitidos(body);
  const id = validarId(idEntrada);
  const data = {};
  if (Object.hasOwn(body, 'nome')) data.nome = validarNome(body.nome);
  if (Object.hasOwn(body, 'cpf')) data.cpf = normalizarCpf(body.cpf);
  if (Object.hasOwn(body, 'email')) data.email = normalizarEmail(body.email);
  if (Object.hasOwn(body, 'telefone')) data.telefone = normalizarTelefone(body.telefone);
  if (Object.hasOwn(body, 'usuarioId')) data.usuarioId = await verificarConta(body.usuarioId);
  if (Object.hasOwn(body, 'ativo')) {
    if (typeof body.ativo !== 'boolean') falha('Ativo deve ser booleano');
    data.ativo = body.ativo;
  }
  if (!Object.keys(data).length) falha('Informe ao menos um campo para atualizar');
  try {
    if (Object.hasOwn(body, 'usuarioId')) {
      return await prisma.$transaction(async (tx) => {
        const atual = await tx.cliente.findUnique({ where: { id }, select: { usuarioId: true } });
        if (!atual) falha('Cliente não encontrado', 404);
        if (atual.usuarioId !== data.usuarioId) {
          const possuiLocacoes = await tx.locacao.findFirst({ where: { clienteId: id }, select: { id: true } });
          if (possuiLocacoes) falha('O vínculo de conta não pode ser alterado após a primeira locação', 409);
        }
        return tx.cliente.update({
          where: { id },
          data,
          include: { usuario: { select: usuarioPublico } },
        });
      }, { isolationLevel: 'Serializable' });
    }
    return await prisma.cliente.update({
      where: { id },
      data,
      include: { usuario: { select: usuarioPublico } },
    });
  } catch (error) {
    if (error?.code === 'P2025') falha('Cliente não encontrado', 404);
    if (error?.code === 'P2034') falha('O vínculo de conta não pode ser alterado devido a uma alteração concorrente', 409);
    tratarConflito(error);
  }
}

module.exports = { listar, buscar, criar, editar, obterMeuPerfil, normalizarCpf, validarNome, normalizarEmail, normalizarTelefone };
