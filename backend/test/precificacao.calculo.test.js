const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularPreco, calcularCustoMinimo } = require("../src/services/precificacao.calculo");

function base(overrides = {}) {
  const start = "2027-05-10T12:00:00.000Z";
  const end = "2027-05-12T12:00:00.000Z";
  return {
    veiculo: { id: 1, categoriaId: 2, valorCompra: "2200.00", valorRevendaEstimado: "1000.00", vidaUtilMeses: 1 },
    custoVeiculo: { custoCapitalMensal: "750.00", ipvaAnual: "2000.00", seguroAnual: "4000.00", licenciamentoAnual: "570.00", manutencaoPorKm: "1.0000" },
    config: { ocupacaoAlvoPercentual: "70.00", margemDesejadaPercentual: "30.00", custoAdministrativoMensal: "0.00", kmMedioDiario: 5, limpezaPorLocacao: "300.00", diasMediosLocacao: 30, comissaoPercentual: "0.00", taxaPagamentoPercentual: "0.00", precoMinimoMargemPercentual: null, issPercentual: "0.00", taxaCartaoPercentual: "0.00", parcelamentoJurosPercentual: "0.00", parcelamentoMax: 1, valorKmExcedente: "0.00", taxaReposicaoCombustivel: "0.00", taxaCombustivelPorLitro: "0.00", taxaLimpeza: "0.00", taxaAeroporto: "0.00", taxaOutraFilial: "0.00", taxaEntregaDomicilioFixa: "0.00", taxaEntregaPorKm: "0.00" },
    tarifa: { id: 1, valorDiaria: "200.00", valorSemanal: null, valorMensal: null },
    regras: [], adicionais: [], protecoes: [], promocao: null, nivelFidelidade: null,
    ocupacaoPercentual: 0, categoriaPiso: null,
    dataInicio: start, dataDevolucao: end, agora: new Date("2027-05-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("custo mínimo aplica ocupação e margem pela fórmula aprovada", () => {
  const params = base();
  const result = calcularCustoMinimo(params.veiculo, params.custoVeiculo, params.config);
  assert.equal(result.completo, true);
  assert.equal(result.componentes.custoDiarioOperacional, "98.00");
  assert.equal(result.componentes.custoPorDiariaAlugada, "140.00");
  assert.equal(result.minimoDiario.toFixed(2), "200.00");
});

test("não inventa custo quando campos essenciais ainda estão ausentes", () => {
  const params = base({ custoVeiculo: null });
  const result = calcularCustoMinimo(params.veiculo, params.custoVeiculo, params.config);
  assert.deepEqual(result, { completo: false, minimoDiario: null, componentes: null });
});

test("escolhe pacote semanal total quando é mais econômico", () => {
  const params = base({
    tarifa: { id: 2, valorDiaria: "100.00", valorSemanal: "560.00", valorMensal: null },
    dataDevolucao: "2027-05-17T12:00:00.000Z",
    categoriaPiso: null,
    veiculo: { id: 1, categoriaId: 2, valorCompra: null, valorRevendaEstimado: null, vidaUtilMeses: null },
    custoVeiculo: null,
    config: { ...base().config, ocupacaoAlvoPercentual: null, margemDesejadaPercentual: null, custoAdministrativoMensal: null, kmMedioDiario: null, limpezaPorLocacao: null, diasMediosLocacao: null, comissaoPercentual: null, taxaPagamentoPercentual: null },
  });
  const result = calcularPreco(params);
  assert.equal(result.subtotalDiarias.toFixed(2), "560.00");
  assert.equal(result.qtdDiarias, 7);
});

test("regras percentuais acumuláveis são aplicadas sequencialmente por prioridade", () => {
  const params = base({
    dataDevolucao: "2027-05-11T12:00:00.000Z",
    regras: [
      { id: 2, nome: "desconto", tipo: "duracao", duracaoMinDiarias: 1, tipoAjuste: "percentual", valorAjuste: "-5.00", prioridade: 2, acumulavel: true, ativo: true },
      { id: 1, nome: "temporada", tipo: "duracao", duracaoMinDiarias: 1, tipoAjuste: "percentual", valorAjuste: "10.00", prioridade: 1, acumulavel: true, ativo: true },
    ],
  });
  const result = calcularPreco(params);
  assert.equal(result.subtotalDiarias.toFixed(2), "209.00");
});

test("regra não acumulável impede soma com outras regras dinâmicas", () => {
  const params = base({
    dataDevolucao: "2027-05-11T12:00:00.000Z",
    regras: [
      { id: 1, nome: "selecionada", tipo: "duracao", duracaoMinDiarias: 1, tipoAjuste: "valor_fixo", valorAjuste: "5.00", prioridade: 1, acumulavel: false, ativo: true },
      { id: 2, nome: "ignorada", tipo: "duracao", duracaoMinDiarias: 1, tipoAjuste: "valor_fixo", valorAjuste: "10.00", prioridade: 2, acumulavel: true, ativo: true },
    ],
  });
  const result = calcularPreco(params);
  assert.equal(result.subtotalDiarias.toFixed(2), "205.00");
});

test("aplica adicionais, proteção, cupom, fidelidade e ISS em ordem", () => {
  const params = base({
    dataDevolucao: "2027-05-12T12:00:00.000Z",
    custoVeiculo: null,
    adicionais: [{ id: 3, nome: "GPS", tipoCobranca: "por_diaria", valor: "10.00", quantidade: 1, valorMaximoLocacao: null }],
    protecoes: [{ protecaoId: 4, nome: "Proteção", valorDiaria: "5.00" }],
    promocao: { id: 5, codigoCupom: "PROMO", tipoDesconto: "percentual", valorDesconto: "10.00", acumulavel: true },
    nivelFidelidade: { id: 6, nome: "Prata", descontoPercentual: "5.00" },
    config: { ...base().config, issPercentual: "10.00" },
  });
  const result = calcularPreco(params);
  assert.equal(result.subtotalDiarias.toFixed(2), "400.00");
  assert.equal(result.totalAdicionais.toFixed(2), "20.00");
  assert.equal(result.totalProtecoes.toFixed(2), "10.00");
  assert.equal(result.descontoTotal.toFixed(2), "58.00");
  assert.equal(result.impostosTaxas.toFixed(2), "37.20");
  assert.equal(result.valorTotal.toFixed(2), "409.20");
});

test("limita cupom e fidelidade ao valor acima do piso líquido", () => {
  const params = base({
    tarifa: { id: 1, valorDiaria: "250.00", valorSemanal: null, valorMensal: null },
    promocao: { id: 5, codigoCupom: "PROMO", tipoDesconto: "percentual", valorDesconto: "10.00", acumulavel: true },
    nivelFidelidade: { id: 6, nome: "Ouro", descontoPercentual: "50.00" },
  });
  const result = calcularPreco(params);
  assert.equal(result.subtotalDiarias.toFixed(2), "500.00");
  assert.equal(result.detalhes.descontoPromocao.valor.toFixed(2), "50.00");
  assert.equal(result.detalhes.descontoPromocao.limitadoPiso, false);
  assert.equal(result.detalhes.descontoFidelidade.valor.toFixed(2), "50.00");
  assert.equal(result.detalhes.descontoFidelidade.limitadoPiso, true);
  assert.equal(result.descontoTotal.toFixed(2), "100.00");
  assert.equal(result.valorTotal.toFixed(2), "400.00");
});

test("marca quando um cupom é limitado para preservar o piso", () => {
  const params = base({
    promocao: { id: 5, codigoCupom: "TOTAL", tipoDesconto: "percentual", valorDesconto: "100.00", acumulavel: false },
  });
  const result = calcularPreco(params);
  assert.equal(result.detalhes.descontoPromocao.valor.toFixed(2), "0.00");
  assert.equal(result.detalhes.descontoPromocao.limitadoPiso, true);
  assert.equal(result.valorTotal.toFixed(2), "400.00");
});

test("recusa uma diária que fica abaixo do piso após ajuste dinâmico", () => {
  const params = base({
    dataDevolucao: "2027-05-11T12:00:00.000Z",
    categoriaPiso: "190.00",
    regras: [{ id: 1, nome: "desconto", tipo: "duracao", duracaoMinDiarias: 1, tipoAjuste: "percentual", valorAjuste: "-10.00", prioridade: 1, acumulavel: true, ativo: true }],
  });
  assert.throws(() => calcularPreco(params), (error) => error.status === 409 && /piso/.test(error.message));
});

test("recusa total que excede DECIMAL(10,2) da locação", () => {
  const params = base({ tarifa: { id: 9, valorDiaria: "99999999.99", valorSemanal: null, valorMensal: null } });
  assert.throws(() => calcularPreco(params), (error) => error.status === 409 && /limite DECIMAL/.test(error.message));
});
