const Decimal = require("decimal.js");
const AppError = require("../lib/AppError");

Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
const DIA_MS = 24 * 60 * 60 * 1000;
const ZERO = new Decimal(0);

function dec(value, campo, { nullable = false, min = null, max = null } = {}) {
  if ((value === null || value === undefined || value === "") && nullable) return null;
  let result;
  try {
    result = new Decimal(value);
  } catch {
    throw new AppError(`${campo} inválido`, 400);
  }
  if (!result.isFinite() || (min !== null && result.lt(min)) || (max !== null && result.gt(max)))
    throw new AppError(`${campo} inválido`, 400);
  return result;
}

function moeda(value) {
  return dec(value, "valor monetário").toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function serializar(value) {
  return moeda(value).toFixed(2);
}

function dataUTC(value, campo) {
  const source = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) throw new AppError(`${campo} inválida`, 400);
  const date = new Date(`${source}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== source)
    throw new AppError(`${campo} inválida`, 400);
  return date;
}

function calcularQuantidadeDiarias(inicio, fim) {
  const parseInstant = (value, campo) => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) throw new AppError(`${campo} inválida`, 400);
      return new Date(value);
    }
    const text = String(value || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return dataUTC(text, campo);
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) throw new AppError(`${campo} inválida`, 400);
    return parsed;
  };
  const start = parseInstant(inicio, "Data de início");
  const end = parseInstant(fim, "Data de devolução");
  if (end <= start) throw new AppError("Data de devolução deve ser posterior à retirada", 400);
  return {
    inicio: start,
    fim: end,
    inicioData: dataUTC(start, "Data de início"),
    fimData: dataUTC(end, "Data de devolução"),
    qtdDiarias: Math.ceil((end - start) / DIA_MS),
  };
}

function calcularCustoMinimo(veiculo, custo, config) {
  const inputs = [
    veiculo?.valorCompra,
    veiculo?.valorRevendaEstimado,
    veiculo?.vidaUtilMeses,
    custo?.custoCapitalMensal,
    custo?.ipvaAnual,
    custo?.seguroAnual,
    custo?.licenciamentoAnual,
    custo?.manutencaoPorKm,
    config?.ocupacaoAlvoPercentual,
    config?.margemDesejadaPercentual,
    config?.custoAdministrativoMensal,
    config?.kmMedioDiario,
    config?.limpezaPorLocacao,
    config?.diasMediosLocacao,
    config?.comissaoPercentual,
    config?.taxaPagamentoPercentual,
  ];
  if (inputs.some((value) => value === null || value === undefined))
    return { completo: false, minimoDiario: null, componentes: null };

  const compra = dec(veiculo.valorCompra, "valorCompra", { min: 0 });
  const revenda = dec(veiculo.valorRevendaEstimado, "valorRevendaEstimado", { min: 0 });
  const vidaMeses = new Decimal(veiculo.vidaUtilMeses);
  const capitalMensal = dec(custo.custoCapitalMensal, "custoCapitalMensal", { min: 0 });
  const ipva = dec(custo.ipvaAnual, "ipvaAnual", { min: 0 });
  const seguro = dec(custo.seguroAnual, "seguroAnual", { min: 0 });
  const licenciamento = dec(custo.licenciamentoAnual, "licenciamentoAnual", { min: 0 });
  const manutencaoKm = dec(custo.manutencaoPorKm, "manutencaoPorKm", { min: 0 });
  const ocupacao = dec(config.ocupacaoAlvoPercentual, "ocupacaoAlvoPercentual", { min: 0.01, max: 100 }).div(100);
  const margem = dec(config.margemDesejadaPercentual, "margemDesejadaPercentual", { min: 0, max: 99.99 }).div(100);
  const administrativoMes = dec(config.custoAdministrativoMensal, "custoAdministrativoMensal", { min: 0 });
  const kmDia = dec(config.kmMedioDiario, "kmMedioDiario", { min: 0 });
  const limpeza = dec(config.limpezaPorLocacao, "limpezaPorLocacao", { min: 0 });
  const diasMedios = dec(config.diasMediosLocacao, "diasMediosLocacao", { min: 1 });
  const comissao = dec(config.comissaoPercentual, "comissaoPercentual", { min: 0, max: 99.99 }).div(100);
  const taxaPagamento = dec(config.taxaPagamentoPercentual, "taxaPagamentoPercentual", { min: 0, max: 99.99 }).div(100);
  if (vidaMeses.lte(0) || compra.lt(revenda) || comissao.plus(taxaPagamento).gte(1))
    throw new AppError("Dados de custo incompatíveis com a fórmula de preço", 409);

  const depreciacaoDia = compra.minus(revenda).div(vidaMeses.times(30));
  const capitalDia = capitalMensal.div(30);
  const tributosDia = ipva.plus(seguro).plus(licenciamento).div(365);
  const estruturaDia = administrativoMes.div(30);
  const manutencaoDia = manutencaoKm.times(kmDia);
  const limpezaDia = limpeza.div(diasMedios);
  const custoDiarioOperacional = depreciacaoDia.plus(capitalDia).plus(tributosDia).plus(estruturaDia).plus(manutencaoDia).plus(limpezaDia);
  const custoPorDiariaAlugada = custoDiarioOperacional.div(ocupacao);
  const precoComMargem = custoPorDiariaAlugada.div(new Decimal(1).minus(margem));
  const minimoDiario = precoComMargem.div(new Decimal(1).minus(comissao).minus(taxaPagamento)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    completo: true,
    minimoDiario,
    componentes: {
      depreciacaoDiaria: serializar(depreciacaoDia),
      capitalDiario: serializar(capitalDia),
      tributosDiarios: serializar(tributosDia),
      estruturaDiaria: serializar(estruturaDia),
      manutencaoDiaria: serializar(manutencaoDia),
      limpezaDiaria: serializar(limpezaDia),
      custoDiarioOperacional: serializar(custoDiarioOperacional),
      custoPorDiariaAlugada: serializar(custoPorDiariaAlugada),
      comissaoPercentual: comissao.times(100).toFixed(2),
      taxaPagamentoPercentual: taxaPagamento.times(100).toFixed(2),
      margemDesejadaPercentual: margem.times(100).toFixed(2),
    },
  };
}

function regraElegivel(regra, dia, qtdDiarias, antecedenciaDias, ocupacaoPercentual) {
  if (regra.categoriaId !== null && regra.categoriaId !== undefined && regra.categoriaId !== dia.categoriaId) return false;
  switch (regra.tipo) {
    case "sazonalidade":
      return (!regra.dataInicio || dia.data >= dataUTC(regra.dataInicio, "dataInicio")) &&
        (!regra.dataFim || dia.data <= dataUTC(regra.dataFim, "dataFim"));
    case "dia_semana": {
      const days = Array.isArray(regra.diasSemana) ? regra.diasSemana : [];
      return days.includes(dia.data.getUTCDay());
    }
    case "antecedencia":
      return (regra.antecedenciaMinDias === null || regra.antecedenciaMinDias === undefined || antecedenciaDias >= regra.antecedenciaMinDias) &&
        (regra.antecedenciaMaxDias === null || regra.antecedenciaMaxDias === undefined || antecedenciaDias <= regra.antecedenciaMaxDias);
    case "ocupacao":
      return ocupacaoPercentual !== null && new Decimal(ocupacaoPercentual).gte(regra.ocupacaoMinPercentual || 0);
    case "duracao":
      return qtdDiarias >= Number(regra.duracaoMinDiarias || 0);
    default:
      return false;
  }
}

function aplicarRegras(diariaBase, data, regras, qtdDiarias, antecedenciaDias, ocupacaoPercentual, categoriaId, pisoDiario) {
  const dia = { data, categoriaId };
  const elegiveis = regras
    .filter((regra) => regra.ativo && regraElegivel(regra, dia, qtdDiarias, antecedenciaDias, ocupacaoPercentual))
    .sort((a, b) => a.prioridade - b.prioridade || a.id - b.id);
  const naoAcumulaveis = elegiveis.filter((regra) => !regra.acumulavel);
  const aplicadas = naoAcumulaveis.length ? [naoAcumulaveis[0]] : elegiveis;
  let resultado = new Decimal(diariaBase);
  const detalhe = [];
  for (const regra of aplicadas) {
    const ajuste = dec(regra.valorAjuste, `regra ${regra.id}`, { min: -99999999.99, max: 99999999.99 });
    if (regra.tipoAjuste === "percentual") {
      if (ajuste.lte(-100)) throw new AppError("Regra percentual não pode reduzir a diária a zero", 409);
      resultado = resultado.times(new Decimal(1).plus(ajuste.div(100)));
    } else {
      resultado = resultado.plus(ajuste);
    }
    detalhe.push({ id: regra.id, nome: regra.nome, tipo: regra.tipo, tipoAjuste: regra.tipoAjuste, valorAjuste: ajuste.toFixed(2), prioridade: regra.prioridade });
  }
  resultado = resultado.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (resultado.lt(pisoDiario)) return { valor: null, aplicadas: detalhe };
  return { valor: resultado, aplicadas: detalhe };
}

function calcularPreco(params) {
  const { veiculo, custoVeiculo, config, tarifa, regras = [], adicionais = [], protecoes = [], promocao = null, nivelFidelidade = null, ocupacaoPercentual = null, categoriaPiso = null, dataInicio, dataDevolucao, agora = new Date(), taxas = {}, formaPagamento = null, parcelas = 1, caucao = null } = params;
  const { inicio, fim, inicioData, qtdDiarias } = calcularQuantidadeDiarias(dataInicio, dataDevolucao);
  if (qtdDiarias > 65535) throw new AppError("Quantidade de diárias excede o limite suportado", 400);
  const custo = calcularCustoMinimo(veiculo, custoVeiculo, config);
  const margemMinima = config.precoMinimoMargemPercentual === null || config.precoMinimoMargemPercentual === undefined
    ? null
    : dec(config.precoMinimoMargemPercentual, "precoMinimoMargemPercentual", { min: 0, max: 99.99 });
  let piso = categoriaPiso === null || categoriaPiso === undefined ? ZERO : dec(categoriaPiso, "precoPisoCategoria", { min: 0 });
  if (custo.completo && margemMinima) {
    const custoBase = custo.minimoDiario;
    // A margem mínima serve como piso independente da margem-alvo configurada.
    const minimaMargem = custo.componentes.custoPorDiariaAlugada
      ? new Decimal(custo.componentes.custoPorDiariaAlugada).div(new Decimal(1).minus(margemMinima.div(100))).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      : custoBase;
    if (minimaMargem.gt(piso)) piso = minimaMargem;
  } else if (custo.completo && custo.minimoDiario.gt(piso)) {
    piso = custo.minimoDiario;
  }
  const tarifaDiaria = dec(tarifa.valorDiaria, "valorDiaria", { min: 0.01 });
  if (tarifaDiaria.lt(piso)) throw new AppError("Tarifa diária abaixo do custo mínimo ou piso da categoria", 409);

  const leadMs = inicioData.getTime() - dataUTC(agora, "data da cotação").getTime();
  const antecedenciaDias = Math.max(0, Math.floor(leadMs / DIA_MS));
  const dayRules = (index, baseDia) => aplicarRegras(
    baseDia,
    new Date(inicioData.getTime() + index * DIA_MS),
    regras,
    qtdDiarias,
    antecedenciaDias,
    ocupacaoPercentual,
    veiculo.categoriaId,
    piso,
  );

  // Programação dinâmica: compara diária, pacotes de sete dias e de trinta dias.
  const dp = Array(qtdDiarias + 1).fill(null);
  dp[0] = { total: ZERO, segmentos: [], regras: [] };
  const opcoes = [{ tamanho: 1, valor: tarifaDiaria, tipo: "diaria" }];
  if (tarifa.valorSemanal !== null && tarifa.valorSemanal !== undefined)
    opcoes.push({ tamanho: 7, valor: dec(tarifa.valorSemanal, "valorSemanal", { min: 0.01 }).div(7), tipo: "semanal" });
  if (tarifa.valorMensal !== null && tarifa.valorMensal !== undefined)
    opcoes.push({ tamanho: 30, valor: dec(tarifa.valorMensal, "valorMensal", { min: 0.01 }).div(30), tipo: "mensal" });
  for (let i = 0; i < qtdDiarias; i += 1) {
    if (!dp[i]) continue;
    for (const opcao of opcoes) {
      if (i + opcao.tamanho > qtdDiarias) continue;
      let segmento = ZERO;
      const regrasSegmento = [];
      let invalido = false;
      for (let offset = 0; offset < opcao.tamanho; offset += 1) {
        const regraResult = dayRules(i + offset, opcao.valor);
        if (!regraResult.valor) { invalido = true; break; }
        segmento = segmento.plus(regraResult.valor);
        regrasSegmento.push({ data: new Date(inicioData.getTime() + (i + offset) * DIA_MS).toISOString().slice(0, 10), regras: regraResult.aplicadas });
      }
      if (invalido) continue;
      const candidate = {
        total: dp[i].total.plus(segmento),
        segmentos: [...dp[i].segmentos, { tipo: opcao.tipo, diarias: opcao.tamanho, subtotal: serializar(segmento) }],
        regras: [...dp[i].regras, ...regrasSegmento],
      };
      if (!dp[i + opcao.tamanho] || candidate.total.lt(dp[i + opcao.tamanho].total)) dp[i + opcao.tamanho] = candidate;
    }
  }
  if (!dp[qtdDiarias]) throw new AppError("Nenhuma combinação de tarifa atende ao piso mínimo", 409);
  const subtotalDiarias = dp[qtdDiarias].total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let totalAdicionais = ZERO;
  const adicionaisDetalhe = [];
  for (const item of adicionais) {
    const quantidade = Number(item.quantidade || 1);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 50) throw new AppError("Quantidade de adicional inválida", 400);
    const valor = dec(item.valor, `adicional ${item.id}`, { min: 0 });
    const bruto = item.tipoCobranca === "por_diaria" ? valor.times(qtdDiarias).times(quantidade) : valor.times(quantidade);
    const maximo = item.valorMaximoLocacao === null || item.valorMaximoLocacao === undefined ? null : dec(item.valorMaximoLocacao, "valorMaximoLocacao", { min: 0 });
    const total = (maximo && bruto.gt(maximo) ? maximo : bruto).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    totalAdicionais = totalAdicionais.plus(total);
    adicionaisDetalhe.push({ id: item.id, nome: item.nome, tipoCobranca: item.tipoCobranca, valorUnitario: serializar(valor), quantidade, total: serializar(total) });
  }
  const taxaInputs = ["kmExcedente", "litrosCombustivel", "distanciaEntregaKm"];
  for (const campo of taxaInputs) {
    const value = taxas[campo] === undefined ? 0 : Number(taxas[campo]);
    if (!Number.isFinite(value) || value < 0) throw new AppError(`${campo} inválido`, 400);
  }
  const configTaxa = (key) => dec(config[key] ?? 0, key, { min: 0 });
  const taxasDetalhe = [];
  const addTaxa = (nome, value) => {
    const amount = dec(value, nome, { min: 0 }).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (amount.gt(0)) { totalAdicionais = totalAdicionais.plus(amount); taxasDetalhe.push({ nome, total: serializar(amount) }); }
  };
  addTaxa("km excedente", configTaxa("valorKmExcedente").times(Number(taxas.kmExcedente || 0)));
  if (taxas.reporCombustivel) {
    const litros = Number(taxas.litrosCombustivel || 0);
    addTaxa("reposição de combustível", litros > 0 ? configTaxa("taxaCombustivelPorLitro").times(litros) : configTaxa("taxaReposicaoCombustivel"));
  }
  if (taxas.limpeza) addTaxa("limpeza", configTaxa("taxaLimpeza"));
  if (taxas.aeroporto) addTaxa("aeroporto", configTaxa("taxaAeroporto"));
  if (taxas.outraFilial) addTaxa("outra filial", configTaxa("taxaOutraFilial"));
  if (taxas.entregaDomicilio) addTaxa("entrega domiciliar", configTaxa("taxaEntregaDomicilioFixa").plus(configTaxa("taxaEntregaPorKm").times(Number(taxas.distanciaEntregaKm || 0))));

  let totalProtecoes = ZERO;
  const protecoesDetalhe = [];
  for (const protecao of protecoes) {
    const total = dec(protecao.valorDiaria, `proteção ${protecao.protecaoId}`, { min: 0 }).times(qtdDiarias).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    totalProtecoes = totalProtecoes.plus(total);
    protecoesDetalhe.push({ protecaoId: protecao.protecaoId, nome: protecao.nome, diaria: serializar(protecao.valorDiaria), total: serializar(total) });
  }

  const subtotalParaDesconto = subtotalDiarias;
  let descontoDisponivel = subtotalDiarias.minus(piso.times(qtdDiarias)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (descontoDisponivel.lt(0)) descontoDisponivel = ZERO;
  let descontoPromocao = ZERO;
  let descontoPromocaoLimitadoPiso = false;
  if (promocao) {
    const valor = dec(promocao.valorDesconto, "valorDesconto", { min: 0 });
    let solicitado = promocao.tipoDesconto === "percentual" ? subtotalParaDesconto.times(valor).div(100) : valor;
    if (solicitado.gt(subtotalParaDesconto)) solicitado = subtotalParaDesconto;
    solicitado = solicitado.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (solicitado.gt(descontoDisponivel)) descontoPromocaoLimitadoPiso = true;
    descontoPromocao = Decimal.min(solicitado, descontoDisponivel);
    descontoDisponivel = descontoDisponivel.minus(descontoPromocao);
  }
  let descontoFidelidade = ZERO;
  let descontoFidelidadeLimitadoPiso = false;
  if (nivelFidelidade && (!promocao || promocao.acumulavel)) {
    const pct = dec(nivelFidelidade.descontoPercentual, "descontoPercentual", { min: 0, max: 100 });
    const base = subtotalParaDesconto.minus(descontoPromocao);
    const solicitado = base.times(pct).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (solicitado.gt(descontoDisponivel)) descontoFidelidadeLimitadoPiso = true;
    descontoFidelidade = Decimal.min(solicitado, descontoDisponivel);
    descontoDisponivel = descontoDisponivel.minus(descontoFidelidade);
  }
  const descontoTotal = descontoPromocao.plus(descontoFidelidade).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const subtotalLiquidoDiarias = subtotalDiarias.minus(descontoTotal);
  const baseTributavel = subtotalLiquidoDiarias.plus(totalAdicionais).plus(totalProtecoes);
  const iss = baseTributavel.times(configTaxa("issPercentual")).div(100);
  let taxaCartao = ZERO;
  let jurosParcelamento = ZERO;
  if (formaPagamento === "cartao") {
    taxaCartao = baseTributavel.times(configTaxa("taxaCartaoPercentual")).div(100);
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > Number(config.parcelamentoMax || 1))
      throw new AppError("Quantidade de parcelas inválida", 400);
    if (parcelas > 1) jurosParcelamento = baseTributavel.times(configTaxa("parcelamentoJurosPercentual")).div(100).times(parcelas - 1);
  } else if (formaPagamento && !["pix", "dinheiro", "boleto", "faturado"].includes(formaPagamento)) {
    throw new AppError("Forma de pagamento inválida", 400);
  }
  const impostosTaxas = iss.plus(taxaCartao).plus(jurosParcelamento).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const valorTotal = subtotalLiquidoDiarias.plus(totalAdicionais).plus(totalProtecoes).plus(impostosTaxas).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const valorDiariaAplicada = subtotalDiarias.div(qtdDiarias).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const maxSnapshot = new Decimal("9999999999.99");
  if ([subtotalDiarias, totalAdicionais, totalProtecoes, descontoTotal, impostosTaxas].some((value) => value.gt(maxSnapshot)))
    throw new AppError("Componente do preço excede o limite DECIMAL suportado", 409);
  if (valorTotal.gt("99999999.99")) throw new AppError("Total da locação excede o limite DECIMAL suportado", 409);

  return {
    valorDiariaAplicada,
    qtdDiarias,
    subtotalDiarias,
    totalAdicionais: totalAdicionais.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    totalProtecoes: totalProtecoes.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    descontoTotal,
    impostosTaxas,
    valorTotal,
    valorCaucao: caucao === null || caucao === undefined ? null : dec(caucao, "caucao", { min: 0 }).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    recomendacaoCusto: custo.completo ? { completa: true, diariaMinima: custo.minimoDiario, componentes: custo.componentes } : { completa: false, diariaMinima: null, componentes: null },
    detalhes: {
      pacotes: dp[qtdDiarias].segmentos,
      regras: dp[qtdDiarias].regras,
      adicionais: adicionaisDetalhe,
      taxasAdicionais: taxasDetalhe,
      protecoes: protecoesDetalhe,
      descontoPromocao: { promocaoId: promocao?.id ?? null, valor: descontoPromocao, limitadoPiso: descontoPromocaoLimitadoPiso },
      descontoFidelidade: { nivelId: nivelFidelidade?.id ?? null, nome: nivelFidelidade?.nome ?? null, valor: descontoFidelidade, limitadoPiso: descontoFidelidadeLimitadoPiso },
      impostos: { iss, cartao: taxaCartao, jurosParcelamento },
      ocupacaoPercentual,
      antecedenciaDias,
      tarifaId: tarifa.id,
      categoriaPiso: categoriaPiso ?? null,
    },
    regrasAplicadas: {
      versao: 1,
      tarifa: { id: tarifa.id, categoriaId: veiculo.categoriaId, valorDiaria: serializar(tarifaDiaria), valorSemanal: tarifa.valorSemanal === null ? null : serializar(tarifa.valorSemanal), valorMensal: tarifa.valorMensal === null ? null : serializar(tarifa.valorMensal) },
      datas: { inicio: inicio.toISOString(), devolucao: fim.toISOString(), qtdDiarias },
      custo: custo.completo ? { diariaMinima: serializar(custo.minimoDiario), componentes: custo.componentes } : { completa: false },
      detalhes: {
        pacotes: dp[qtdDiarias].segmentos,
        regras: dp[qtdDiarias].regras,
        adicionais: adicionaisDetalhe,
        taxasAdicionais: taxasDetalhe,
        protecoes: protecoesDetalhe,
        descontoPromocao: { promocaoId: promocao?.id ?? null, codigoCupom: promocao?.codigoCupom ?? null, valor: serializar(descontoPromocao), limitadoPiso: descontoPromocaoLimitadoPiso },
        descontoFidelidade: { nivelId: nivelFidelidade?.id ?? null, nome: nivelFidelidade?.nome ?? null, percentual: nivelFidelidade?.descontoPercentual?.toString?.() ?? "0", valor: serializar(descontoFidelidade), limitadoPiso: descontoFidelidadeLimitadoPiso },
        impostos: { iss: serializar(iss), cartao: serializar(taxaCartao), jurosParcelamento: serializar(jurosParcelamento) },
        ocupacaoPercentual,
        antecedenciaDias,
      },
      total: serializar(valorTotal),
    },
  };
}

module.exports = { calcularPreco, calcularCustoMinimo, calcularQuantidadeDiarias, aplicarRegras, dataUTC, dec, moeda, serializar };
