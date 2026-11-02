const bcrypt = require("bcrypt");

function dataUTC(texto) {
  return new Date(`${texto}T00:00:00.000Z`);
}

async function usuarioSeAusente(prisma, { nome, email, senha, papel = "USER" }) {
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) return existente;
  const senhaHash = await bcrypt.hash(senha, 10);
  try {
    return await prisma.usuario.create({ data: { nome, email, senhaHash, papel } });
  } catch (erro) {
    if (erro.code === "P2002") return prisma.usuario.findUnique({ where: { email } });
    throw erro;
  }
}

async function seedCadastros(prisma) {
  const senhaDemo = process.env.SEED_DEMO_PASSWORD || "123456";
  const senhaAdmin = process.env.SEED_ADMIN_PASSWORD || "Admin@Locadora123";
  const emailDemo = process.env.SEED_DEMO_EMAIL || "demo@locadora.com";
  const emailAdmin = process.env.SEED_ADMIN_EMAIL || "dedevelfullstack.arthur@gmail.com";

  const usuarioDemo = await usuarioSeAusente(prisma, {
    nome: "Usuário Demonstração",
    email: emailDemo,
    senha: senhaDemo,
  });
  const contaAdminDemo = await usuarioSeAusente(prisma, {
    nome: "Administrador Demonstração",
    email: emailAdmin,
    senha: senhaAdmin,
    papel: "ADMIN",
  });
  // Um endereço já cadastrado nunca tem seu papel alterado pelo seeder.
  const administradorDemo = contaAdminDemo.papel === "ADMIN" ? contaAdminDemo : usuarioDemo;

  const nomesCategorias = ["Econômico", "SUV", "Executivo", "Utilitário", "Compacto", "Sedan", "Luxo"];
  const categorias = {};
  for (const nome of nomesCategorias) {
    categorias[nome] = await prisma.categoriaVeiculo.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }

  const nomesFiliais = ["Matriz", "Unidade Aeroporto"];
  const filiais = {};
  for (const nome of nomesFiliais) {
    filiais[nome] = await prisma.filial.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }

  const nomesOpcionais = [
    "Ar-condicionado",
    "Direção elétrica",
    "Câmbio automático",
    "Central multimídia",
    "Bluetooth",
    "Câmera de ré",
    "Sensor de estacionamento",
    "Vidros elétricos",
    "Trava elétrica",
    "Carregador USB",
    "Controle de cruzeiro",
    "Assistente de faixa",
  ];
  const opcionais = {};
  for (const nome of nomesOpcionais) {
    opcionais[nome] = await prisma.opcionalVeiculo.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }

  const clienteUsuario = await prisma.cliente.upsert({
    where: { usuarioId: usuarioDemo.id },
    update: {},
    create: {
      nome: usuarioDemo.nome,
      email: usuarioDemo.email,
      telefone: "(11) 90000-0000",
      usuarioId: usuarioDemo.id,
    },
  });
  let clienteExemplo = await prisma.cliente.findFirst({
    where: { email: "cliente.demo@example.com" },
  });
  if (!clienteExemplo) {
    clienteExemplo = await prisma.cliente.create({
      data: {
        nome: "Cliente Demonstração",
        email: "cliente.demo@example.com",
        telefone: "(11) 90000-0001",
      },
    });
  }
  if (clienteExemplo.nome !== "Cliente Demonstração") {
    throw new Error("O e-mail reservado cliente.demo@example.com já está associado a outro cliente; o seed não usou nem alterou esse cadastro.");
  }

  const veiculosDemo = [
    {
      placa: "ABC1D23", marca: "Fiat", modelo: "Mobi", versao: "Like 1.0", ano: 2022,
      cor: "Prata", categoria: "Econômico", filial: "Matriz", cambio: "manual", combustivel: "flex",
      motor: "1.0", portas: 4, passageiros: 5, portaMalas: 200, compra: 62000, revenda: 31000,
      fipe: 57000, km: 28400, opcionais: ["Ar-condicionado", "Direção elétrica", "Bluetooth"],
    },
    {
      placa: "DEF4G56", marca: "Chevrolet", modelo: "Onix", versao: "LT 1.0", ano: 2023,
      cor: "Branco", categoria: "Compacto", filial: "Matriz", cambio: "manual", combustivel: "flex",
      motor: "1.0", portas: 4, passageiros: 5, portaMalas: 275, compra: 78000, revenda: 39000,
      fipe: 73000, km: 19750, opcionais: ["Ar-condicionado", "Central multimídia", "Câmera de ré"],
    },
    {
      placa: "GHI7J89", marca: "Volkswagen", modelo: "T-Cross", versao: "Comfortline 1.0 TSI", ano: 2024,
      cor: "Cinza", categoria: "SUV", filial: "Unidade Aeroporto", cambio: "automatico", combustivel: "flex",
      motor: "1.0 turbo", portas: 4, passageiros: 5, portaMalas: 373, compra: 142000, revenda: 76000,
      fipe: 136000, km: 12600, opcionais: ["Ar-condicionado", "Câmbio automático", "Câmera de ré", "Sensor de estacionamento"],
    },
    {
      placa: "JKL0M12", marca: "Toyota", modelo: "Corolla", versao: "XEi 2.0", ano: 2023,
      cor: "Preto", categoria: "Executivo", filial: "Matriz", cambio: "automatico", combustivel: "flex",
      motor: "2.0", portas: 4, passageiros: 5, portaMalas: 470, compra: 158000, revenda: 84000,
      fipe: 151000, km: 22100, opcionais: ["Ar-condicionado", "Câmbio automático", "Central multimídia", "Controle de cruzeiro"],
    },
    {
      placa: "DME0S01", marca: "Honda", modelo: "City", versao: "Sedan Touring", ano: 2024,
      cor: "Azul", categoria: "Sedan", filial: "Unidade Aeroporto", cambio: "automatico", combustivel: "flex",
      motor: "1.5", portas: 4, passageiros: 5, portaMalas: 519, compra: 132000, revenda: 70000,
      fipe: 126000, km: 8400, opcionais: ["Ar-condicionado", "Câmbio automático", "Bluetooth", "Câmera de ré"],
    },
    {
      placa: "DME0U01", marca: "Fiat", modelo: "Fiorino", versao: "Endurance 1.4", ano: 2023,
      cor: "Branco", categoria: "Utilitário", filial: "Matriz", cambio: "manual", combustivel: "flex",
      motor: "1.4", portas: 2, passageiros: 2, portaMalas: 3100, compra: 112000, revenda: 59000,
      fipe: 105000, km: 30500, opcionais: ["Ar-condicionado", "Direção elétrica", "Trava elétrica"],
    },
    {
      placa: "DME0L01", marca: "BMW", modelo: "Série 3", versao: "320i GP 2.0", ano: 2024,
      cor: "Azul-marinho", categoria: "Luxo", filial: "Unidade Aeroporto", cambio: "automatico", combustivel: "gasolina",
      motor: "2.0 turbo", portas: 4, passageiros: 5, portaMalas: 480, compra: 292000, revenda: 158000,
      fipe: 281000, km: 6900, opcionais: ["Ar-condicionado", "Câmbio automático", "Central multimídia", "Assistente de faixa"],
    },
    {
      placa: "DME0E01", marca: "BYD", modelo: "Dolphin", versao: "GS elétrico", ano: 2024,
      cor: "Verde", categoria: "Econômico", filial: "Matriz", cambio: "automatico", combustivel: "eletrico",
      motor: "70 kW", portas: 4, passageiros: 5, portaMalas: 345, compra: 152000, revenda: 81000,
      fipe: 145000, km: 5100, opcionais: ["Ar-condicionado", "Câmbio automático", "Central multimídia", "Câmera de ré", "Carregador USB"],
    },
  ];

  const veiculos = {};
  for (let index = 0; index < veiculosDemo.length; index += 1) {
    const v = veiculosDemo[index];
    const categoria = categorias[v.categoria];
    const filial = filiais[v.filial];
    const veiculo = await prisma.veiculo.upsert({
      where: { placa: v.placa },
      update: {},
      create: {
        placa: v.placa,
        renavam: String(10000000001 + index),
        marca: v.marca,
        modelo: v.modelo,
        versao: v.versao,
        anoFabricacao: v.ano,
        anoModelo: v.ano,
        cor: v.cor,
        categoriaId: categoria.id,
        cambio: v.cambio,
        combustivel: v.combustivel,
        motor: v.motor,
        numPortas: v.portas,
        numPassageiros: v.passageiros,
        capacidadePortaMalas: v.portaMalas,
        dataCompra: dataUTC("2024-01-15"),
        valorCompra: v.compra,
        formaAquisicao: "a_vista",
        valorFipe: v.fipe,
        valorRevendaEstimado: v.revenda,
        vidaUtilMeses: 60,
        crlvVencimento: dataUTC("2027-06-30"),
        ipvaVencimento: dataUTC("2027-03-31"),
        licenciamentoVencimento: dataUTC("2027-06-30"),
        seguradora: "Seguradora Demonstração",
        apoliceNumero: `DEMO-${String(index + 1).padStart(4, "0")}`,
        apoliceVencimento: dataUTC("2027-12-31"),
        apoliceFranquia: 2500,
        status: "disponivel",
        kmAtual: v.km,
        nivelCombustivel: 80,
        filialId: filial.id,
        proximaRevisaoKm: v.km + 10000,
        proximaRevisaoData: dataUTC("2027-03-01"),
        // valorDiaria é legado; a tarifa válida fica em TarifaBase, no módulo de precificação.
      },
    });
    veiculos[v.placa] = veiculo;

    for (const nomeOpcional of v.opcionais) {
      const opcional = opcionais[nomeOpcional];
      await prisma.veiculoOpcional.upsert({
        where: { veiculoId_opcionalId: { veiculoId: veiculo.id, opcionalId: opcional.id } },
        update: {},
        create: { veiculoId: veiculo.id, opcionalId: opcional.id },
      });
    }
  }

  return {
    usuarioDemo,
    administradorDemo,
    contaAdminDemo,
    categorias,
    filiais,
    opcionais,
    veiculos,
    clienteUsuario,
    clienteExemplo,
  };
}

module.exports = { seedCadastros };
