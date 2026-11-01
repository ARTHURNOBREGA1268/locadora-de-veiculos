const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const AppError = require('../lib/AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const selectPublico = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
  criadoEm: true
};

function falha(mensagem) {
  throw new AppError(mensagem, 400);
}

function validarObjeto(dados) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    falha('O corpo da solicitação deve ser um objeto');
  }
}

function validarNome(nome) {
  if (typeof nome !== 'string' || nome.trim().length < 2) {
    falha('Nome é obrigatório (mínimo 2 caracteres)');
  }
  return nome.trim();
}

function validarEmail(email) {
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    falha('E-mail inválido');
  }
  return email.trim().toLowerCase();
}

function validarPapel(papel) {
  if (papel !== 'USER' && papel !== 'ADMIN') {
    falha('Papel deve ser USER ou ADMIN');
  }
  return papel;
}

function validarId(idEntrada) {
  const texto = String(idEntrada);
  const id = Number(texto);
  if (!/^[1-9]\d*$/.test(texto) || !Number.isSafeInteger(id)) {
    falha('ID inválido');
  }
  return id;
}

function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8) {
    falha('Senha deve ter no mínimo 8 caracteres');
  }
}

function conflitoDuplicado(error) {
  if (error && error.code === 'P2002') {
    throw new AppError('E-mail já cadastrado', 409);
  }
  if (error && error.code === 'P2034') {
    throw new AppError('Conflito ao atualizar o usuário; tente novamente', 409);
  }
  throw error;
}

async function listar() {
  return prisma.usuario.findMany({
    select: selectPublico,
    orderBy: { criadoEm: 'desc' }
  });
}

async function criar(dados = {}) {
  validarObjeto(dados);
  const nome = validarNome(dados.nome);
  const email = validarEmail(dados.email);
  validarSenha(dados.senha);
  const papel = dados.papel === undefined ? 'USER' : validarPapel(dados.papel);
  const senhaHash = await bcrypt.hash(dados.senha, 10);

  try {
    return await prisma.$transaction(async tx => {
      const usuario = await tx.usuario.create({
        data: { nome, email, senhaHash, papel },
        select: selectPublico
      });
      await tx.cliente.create({ data: { nome, email, usuarioId: usuario.id } });
      return usuario;
    });
  } catch (error) {
    conflitoDuplicado(error);
  }
}

async function editar(idEntrada, dados = {}, atorId) {
  validarObjeto(dados);
  const id = validarId(idEntrada);
  const data = {};

  if (Object.hasOwn(dados, 'nome')) data.nome = validarNome(dados.nome);
  if (Object.hasOwn(dados, 'email')) data.email = validarEmail(dados.email);
  if (Object.hasOwn(dados, 'senha')) {
    validarSenha(dados.senha);
    data.senhaHash = await bcrypt.hash(dados.senha, 10);
    data.tokenVersion = { increment: 1 };
  }
  if (Object.hasOwn(dados, 'papel')) data.papel = validarPapel(dados.papel);
  if (Object.hasOwn(dados, 'ativo')) {
    if (typeof dados.ativo !== 'boolean') falha('Ativo deve ser booleano');
    data.ativo = dados.ativo;
  }
  if (!Object.keys(data).length) falha('Informe ao menos um campo para atualizar');

  try {
    return await prisma.$transaction(async tx => {
      const alteraAdmin = Object.hasOwn(data, 'papel') || Object.hasOwn(data, 'ativo');
      if (alteraAdmin) {
        await tx.$queryRaw`SELECT id FROM Usuario WHERE papel = 'ADMIN' AND ativo = true FOR UPDATE`;
      }

      const atual = await tx.usuario.findUnique({
        where: { id },
        select: selectPublico
      });
      if (!atual) throw new AppError('Usuário não encontrado', 404);

      const novoPapel = data.papel ?? atual.papel;
      const novoAtivo = data.ativo ?? atual.ativo;
      const removeAdminAtivo = atual.papel === 'ADMIN' && atual.ativo && (novoPapel !== 'ADMIN' || !novoAtivo);

      if (Number(atorId) === id && atual.papel === 'ADMIN' && (novoPapel !== 'ADMIN' || !novoAtivo)) {
        throw new AppError('Não é permitido rebaixar ou inativar a própria conta', 409);
      }
      if (removeAdminAtivo) {
        const adminsAtivos = await tx.usuario.count({ where: { papel: 'ADMIN', ativo: true } });
        if (adminsAtivos <= 1) throw new AppError('Não é permitido remover o último ADMIN ativo', 409);
      }

      if (Object.hasOwn(data, 'ativo') && data.ativo === false && atual.ativo && !Object.hasOwn(data, 'tokenVersion')) {
        data.tokenVersion = { increment: 1 };
      }

      return tx.usuario.update({ where: { id }, data, select: selectPublico });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    conflitoDuplicado(error);
  }
}

module.exports = { listar, criar, editar };
