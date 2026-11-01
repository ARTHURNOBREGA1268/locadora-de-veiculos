require("dotenv").config();
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const senhaHash = await bcrypt.hash("123456", 10);
  await prisma.usuario.upsert({
    where: { email: "demo@locadora.com" },
    update: {},
    create: { nome: "Usuario Demo", email: "demo@locadora.com", senhaHash },
  });
  for (const nome of [
    "Econômico",
    "SUV",
    "Executivo",
    "Utilitário",
    "Compacto",
    "Sedan",
    "Luxo",
  ])
    await prisma.categoriaVeiculo.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  await prisma.filial.upsert({
    where: { nome: "Matriz" },
    update: {},
    create: { nome: "Matriz" },
  });
  for (const nome of [
    "Ar-condicionado",
    "Direção elétrica",
    "Câmbio automático",
    "Multimídia",
    "Bluetooth",
    "Câmera de ré",
    "Sensor de estacionamento",
    "Vidros elétricos",
    "Trava elétrica",
  ])
    await prisma.opcionalVeiculo.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  const cat = await prisma.categoriaVeiculo.findUnique({
      where: { nome: "Econômico" },
    }),
    filial = await prisma.filial.findUnique({ where: { nome: "Matriz" } });
  const veiculos = [
    {
      marca: "Fiat",
      modelo: "Mobi",
      placa: "ABC1D23",
      anoFabricacao: 2022,
      anoModelo: 2022,
      valorDiaria: 120,
      status: "disponivel",
    },
    {
      marca: "Chevrolet",
      modelo: "Onix",
      placa: "DEF4G56",
      anoFabricacao: 2023,
      anoModelo: 2023,
      valorDiaria: 150,
      status: "disponivel",
    },
    {
      marca: "Volkswagen",
      modelo: "T-Cross",
      placa: "GHI7J89",
      anoFabricacao: 2024,
      anoModelo: 2024,
      valorDiaria: 220,
      status: "disponivel",
    },
    {
      marca: "Toyota",
      modelo: "Corolla",
      placa: "JKL0M12",
      anoFabricacao: 2023,
      anoModelo: 2023,
      valorDiaria: 260,
      status: "disponivel",
    },
  ];
  for (const v of veiculos)
    await prisma.veiculo.upsert({
      where: { placa: v.placa },
      update: {},
      create: { ...v, categoriaId: cat.id, filialId: filial.id },
    });
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
