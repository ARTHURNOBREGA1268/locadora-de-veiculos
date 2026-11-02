require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { seedCadastros } = require("./seeders/cadastros");
const { seedConfiguracoes } = require("./seeders/configuracoes");
const { seedHistorico } = require("./seeders/historico");

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("O seeder contém dados fictícios e não pode ser executado em produção.");
  }

  const contexto = await seedCadastros(prisma);
  const configuracoes = await seedConfiguracoes(prisma, contexto);
  const historico = await seedHistorico(prisma, contexto, configuracoes);

  console.log("Seed demonstrativo concluído com segurança.");
  console.log(`Usuário demo: ${contexto.usuarioDemo.email}`);
  if (contexto.contaAdminDemo.papel === "ADMIN") {
    console.log(`Administrador demo: ${contexto.contaAdminDemo.email}`);
  } else {
    console.log("Administrador demo não criado: o e-mail configurado já existe com outro papel; nenhuma promoção foi feita.");
  }
  console.log(`Veículos de demonstração: ${Object.keys(contexto.veiculos).length}`);
  console.log(`Novas tarifas-base criadas: ${configuracoes.tarifasCriadas.length}`);
  console.log(`Locação histórica demo: ${historico.locacaoDemo?.codigo || "não criada"}`);
  console.log("Registros com prefixo DEMO são fictícios; nenhum registro preexistente foi atualizado ou excluído.");
}

main()
  .catch((erro) => {
    console.error("Falha ao executar o seed demonstrativo:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
