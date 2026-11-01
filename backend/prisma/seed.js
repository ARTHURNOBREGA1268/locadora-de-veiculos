require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('123456', 10);

  await prisma.usuario.upsert({
    where: { email: 'demo@locadora.com' },
    update: {},
    create: { nome: 'Usuario Demo', email: 'demo@locadora.com', senhaHash }
  });

  const veiculos = [
    { marca: 'Fiat', modelo: 'Mobi', placa: 'ABC1D23', ano: 2022, valorDiaria: 120 },
    { marca: 'Chevrolet', modelo: 'Onix', placa: 'DEF4G56', ano: 2023, valorDiaria: 150 },
    { marca: 'Volkswagen', modelo: 'T-Cross', placa: 'GHI7J89', ano: 2024, valorDiaria: 220 },
    { marca: 'Toyota', modelo: 'Corolla', placa: 'JKL0M12', ano: 2023, valorDiaria: 260 }
  ];

  for (const veiculo of veiculos) {
    await prisma.veiculo.upsert({
      where: { placa: veiculo.placa },
      update: {},
      create: veiculo
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
