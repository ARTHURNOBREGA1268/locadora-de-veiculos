require('dotenv').config();
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { PrismaClient } = require('@prisma/client');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const email = process.argv[2];

async function main() {
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    throw new Error('Informe um endereço de e-mail válido.');
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  let confirmacao;
  try {
    confirmacao = await rl.question(`Confirme a promoção de ${email.trim().toLowerCase()} digitando PROMOVER: `);
  } finally {
    rl.close();
  }
  if (confirmacao !== 'PROMOVER') {
    throw new Error('Promoção cancelada: confirmação inválida.');
  }

  const prisma = new PrismaClient();
  try {
    const resultado = await prisma.usuario.updateMany({
      where: { email: email.trim().toLowerCase() },
      data: { papel: 'ADMIN' }
    });
    if (resultado.count !== 1) {
      throw new Error('Nenhuma conta cadastrada foi encontrada para esse e-mail.');
    }
    console.log(`Conta ${email.trim().toLowerCase()} promovida a ADMIN.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(erro => {
  console.error(erro.message);
  process.exitCode = 1;
});
