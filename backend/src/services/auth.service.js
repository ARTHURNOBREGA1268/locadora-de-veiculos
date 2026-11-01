const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const AppError = require('../lib/AppError');
const { normalizarCpf } = require('./cliente.service');
const { getJwtSecret } = require('../lib/jwtConfig');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const selectPublico = { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true };

async function registrar({ nome, email, senha, cpf }) {
  if (typeof nome !== 'string' || nome.trim().length < 2) {
    throw new AppError('Nome é obrigatório (mínimo 2 caracteres)', 400);
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    throw new AppError('E-mail inválido', 400);
  }
  if (typeof senha !== 'string' || senha.length < 6) {
    throw new AppError('Senha deve ter no mínimo 6 caracteres', 400);
  }

  const emailNormalizado = email.trim().toLowerCase();

  const existente = await prisma.usuario.findUnique({
    where: { email: emailNormalizado },
    select: { id: true }
  });
  if (existente) {
    throw new AppError('E-mail já cadastrado', 409);
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const cpfNormalizado = normalizarCpf(cpf);
  try {
    return await prisma.$transaction(async tx => {
      const usuario = await tx.usuario.create({
        data: { nome: nome.trim(), email: emailNormalizado, senhaHash },
        select: selectPublico
      });
      await tx.cliente.create({
        data: { nome: nome.trim(), cpf: cpfNormalizado, email: emailNormalizado, usuarioId: usuario.id }
      });
      return usuario;
    });
  } catch (error) {
    if (error?.code === 'P2002') throw new AppError('E-mail ou CPF já cadastrado', 409);
    throw error;
  }
}

async function login({ email, senha }) {
  if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) {
    throw new AppError('E-mail e senha são obrigatórios', 400);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() }
  });

  const credenciaisValidas = usuario && usuario.ativo && (await bcrypt.compare(senha, usuario.senhaHash));
  if (!credenciaisValidas) {
    throw new AppError('Credenciais inválidas', 401);
  }

  const token = jwt.sign({ sub: String(usuario.id), ver: usuario.tokenVersion ?? 0 }, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });

  return {
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      ativo: usuario.ativo,
      criadoEm: usuario.criadoEm
    }
  };
}

async function perfil(usuarioId) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: selectPublico
  });
  if (!usuario || !usuario.ativo) throw new AppError('Usuário inexistente ou inativo', 401);
  return usuario;
}

module.exports = { registrar, login, perfil };
