import { useMemo, useState } from 'react';
import { formatarDataHora, formatarMoeda } from '../utils/format';

const STATUS = {
  reservada: ['Reservada', 'selo-reservada', [['cancelar', 'Cancelar', 'botao-perigo'], ['retirar', 'Confirmar retirada', 'botao-principal']]],
  retirada: ['Retirada', 'selo-retirada', [['iniciar', 'Iniciar locação', 'botao-principal']]],
  em_andamento: ['Em andamento', 'selo-andamento', [['devolver', 'Registrar devolução', 'botao-principal']]],
  devolvida: ['Devolvida', 'selo-devolvida', [['finalizar', 'Finalizar locação', 'botao-principal']]],
  finalizada: ['Finalizada', 'selo-livre', []],
  cancelada: ['Cancelada', 'selo-cancelada', []],
};

const texto = (valor, vazio = '—') => valor === null || valor === undefined || valor === '' ? vazio : String(valor);
const dinheiro = valor => valor === null || valor === undefined ? '—' : formatarMoeda(valor);
const dataHora = valor => valor ? formatarDataHora(valor) : '—';
const nomeCliente = cliente => cliente?.nome || cliente?.nomeCompleto || (cliente?.id ? `Cliente #${cliente.id}` : '—');
const nomeVeiculo = veiculo => [veiculo?.marca, veiculo?.modelo, veiculo?.versao].filter(Boolean).join(' ') || '—';

function Lista({ titulo, itens, render }) {
  return (
    <div className="locacao-detalhe">
      <strong>{titulo}</strong>
      {!itens?.length ? <span>—</span> : itens.map((item, indice) => <span key={item.id ?? indice}>{render(item)}</span>)}
    </div>
  );
}

function Campo({ titulo, children }) {
  return <div className="locacao-detalhe"><strong>{titulo}</strong>{children}</div>;
}

function CobrancaExtraForm({ locacao, processando, onSubmit }) {
  const [tipo, setTipo] = useState('avaria');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento) {
    evento.preventDefault();
    if (!descricao.trim() || Number(valor) <= 0) return;
    setSalvando(true);
    try {
      const sucesso = await onSubmit(locacao, { tipo, descricao: descricao.trim(), valor });
      if (sucesso) { setDescricao(''); setValor(''); setTipo('avaria'); }
    } finally {
      setSalvando(false);
    }
  }

  return <div className="locacao-detalhe"><strong>Registrar cobrança extra</strong>
    <details className="locacao-cobranca-form"><summary>Adicionar avaria, multa ou outra ocorrência</summary>
      <form onSubmit={salvar} className="formulario">
        <label>Tipo<select value={tipo} onChange={evento => setTipo(evento.target.value)}>
          <option value="avaria">Avaria</option><option value="multa_transito">Multa de trânsito</option>
          <option value="limpeza">Limpeza</option><option value="outros">Outros</option>
        </select></label>
        <label>Descrição<textarea required maxLength={120} rows="2" value={descricao} onChange={evento => setDescricao(evento.target.value)} /></label>
        <label>Valor (R$)<input required type="number" min="0.01" max="99999999.99" step="0.01" value={valor} onChange={evento => setValor(evento.target.value)} /></label>
        <small>O saldo fica pendente e será incluído no valor final ao finalizar a locação. Nenhum pagamento é processado.</small>
        <button className="botao botao-secundario" type="submit" disabled={salvando || processando}>{salvando ? 'Registrando…' : 'Registrar cobrança'}</button>
      </form>
    </details>
  </div>;
}

function imprimirContrato(conteudo, codigo) {
  const janela = window.open('', '_blank');
  if (!janela) return;
  janela.opener = null;
  janela.document.title = `Contrato ${codigo || ''}`;
  const titulo = janela.document.createElement('h1');
  titulo.textContent = `Contrato ${codigo || ''}`;
  const textoContrato = janela.document.createElement('pre');
  textoContrato.textContent = conteudo;
  textoContrato.style.whiteSpace = 'pre-wrap';
  textoContrato.style.fontFamily = 'serif';
  janela.document.body.replaceChildren(titulo, textoContrato);
  janela.focus();
  janela.print();
}

function renderVistoria(titulo, vistoria, km, combustivel) {
  if (!vistoria && (km == null || combustivel == null)) {
    return <Campo titulo={titulo}><span>Sem vistoria registrada</span></Campo>;
  }
  return (
    <>
      <Campo titulo={titulo}>
        <span>ID: {texto(vistoria?.id)}</span>
        <span>Data: {dataHora(vistoria?.data)}</span>
        <span>Odômetro: {texto(vistoria?.km ?? km)} km</span>
        <span>Combustível: {texto(vistoria?.nivelCombustivel ?? combustivel)}%</span>
        <span>Observações: {texto(vistoria?.observacoes)}</span>
      </Campo>
      {!!vistoria?.itensChecklist?.length && <Lista titulo={`${titulo} — checklist`} itens={vistoria.itensChecklist} render={item => `${item.descricao}: ${item.conforme ? 'Conforme' : 'Não conforme'}${item.observacoes ? ` · ${item.observacoes}` : ''}`} />}
    </>
  );
}

export default function LocacaoList({ locacoes = [], processandoId, onAcao, admin = false, onCobrancaExtra, onAssinarContrato }) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return locacoes.filter(locacao => {
      if (filtroStatus && locacao.status !== filtroStatus) return false;
      if (!termo) return true;
      const cliente = locacao.cliente || {};
      const veiculo = locacao.veiculo || {};
      const campos = [
        locacao.codigo, locacao.status, locacao.origem, locacao.id,
        cliente.nome, cliente.cpf, cliente.email, cliente.telefone,
        veiculo.placa, veiculo.marca, veiculo.modelo, veiculo.versao,
        locacao.atendente?.nome, locacao.filialRetirada?.nome, locacao.filialDevolucao?.nome,
      ];
      return campos.filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(termo);
    });
  }, [locacoes, busca, filtroStatus]);

  if (!locacoes.length) return <p className="vazio">Você ainda não tem locações. Registre a primeira no formulário acima.</p>;

  return (
    <section className="painel painel-locacoes" aria-label="Lista de locações">
      <div className="locacoes-filtros">
        <label>Buscar locação<input value={busca} onChange={evento => setBusca(evento.target.value)} placeholder="Código, cliente, CPF, e-mail ou placa" /></label>
        <label>Filtrar por status<select value={filtroStatus} onChange={evento => setFiltroStatus(evento.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS).map(([valor, [rotulo]]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select></label>
        <span className="apoio">{filtradas.length} de {locacoes.length} locações</span>
      </div>

      {!filtradas.length ? <p className="vazio">Nenhuma locação corresponde aos filtros.</p> : (
        <div className="tabela-locacoes-scroll">
          <table className="tabela-locacoes">
            <thead><tr>
              <th>Código</th><th>Cliente</th><th>Veículo / categoria</th><th>Período previsto</th>
              <th>Diárias</th><th>Preço / total</th><th>Status</th><th>Origem</th><th>Ações</th>
            </tr></thead>
            <tbody>{filtradas.map(locacao => {
              const [rotulo, classe, acoes] = STATUS[locacao.status] || [locacao.status || 'Desconhecido', 'selo-user', []];
              const cliente = locacao.cliente;
              const veiculo = locacao.veiculo;
              const preco = locacao.preco || {};
              const diaria = preco.valorDiariaAplicada ?? locacao.valorDiaria;
              const total = preco.valorTotal ?? locacao.valorTotal;
              const diarias = locacao.qtdDiariasCobradas ?? locacao.qtdDiariasPrevistas ?? preco.qtdDiarias;
              const inicio = locacao.retiradaPrevista ?? locacao.dataInicio;
              const devolucao = locacao.devolucaoPrevista ?? locacao.dataPrevistaDevolucao;

              return (
                <tr key={locacao.id}>
                  <td data-label="Código"><strong>{texto(locacao.codigo || `#${locacao.id}`)}</strong></td>
                  <td data-label="Cliente">{nomeCliente(cliente)}<small>CPF: {texto(cliente?.cpf)} · {texto(cliente?.email)}</small><small>Telefone: {texto(cliente?.telefone)} · Cliente #{texto(cliente?.id)}</small></td>
                  <td data-label="Veículo / categoria">{nomeVeiculo(veiculo)}<small>Placa: {texto(veiculo?.placa)} · Veículo #{texto(veiculo?.id)}</small><small>Categoria reservada: {texto(locacao.categoria?.nome || locacao.categoriaId)}</small></td>
                  <td data-label="Período previsto">{dataHora(inicio)}<small>Até {dataHora(devolucao)}</small></td>
                  <td data-label="Diárias">{texto(locacao.qtdDiariasPrevistas)} previstas<small>{locacao.qtdDiariasCobradas == null ? 'Cobradas: —' : `${locacao.qtdDiariasCobradas} cobradas`}</small></td>
                  <td data-label="Preço / total">Diária: {dinheiro(diaria)}<small>Total: {dinheiro(locacao.valorFinalCobrado ?? total)}</small><small>Final: {dinheiro(locacao.valorFinalCobrado)}</small></td>
                  <td data-label="Status"><span className={`selo ${classe}`}>{rotulo}</span></td>
                  <td data-label="Origem">{texto(locacao.origem)}<small>Atendente: {texto(locacao.atendente?.nome || locacao.atendenteId)}</small></td>
                  <td data-label="Ações">
                    <div className="locacao-acoes">{acoes.map(([acao, label, estilo]) => (
                      <button key={acao} className={`botao ${estilo}`} disabled={processandoId === locacao.id} onClick={() => onAcao(locacao, acao)}>
                        {processandoId === locacao.id ? 'Atualizando…' : label}
                      </button>
                    ))}</div>
                    <details className="locacao-expansao"><summary>Detalhes completos</summary>
                      <div className="locacao-detalhes-grade">
                        <Campo titulo="Cliente"><span>{nomeCliente(cliente)} · ID {texto(cliente?.id)}</span><span>CPF: {texto(cliente?.cpf)} · e-mail: {texto(cliente?.email)}</span><span>Telefone: {texto(cliente?.telefone)}</span></Campo>
                        <Campo titulo="Identificação e período"><span>Código: {texto(locacao.codigo)} · Origem: {texto(locacao.origem)}</span><span>Categoria congelada: {texto(locacao.categoria?.nome || locacao.categoriaId)}</span><span>Prevista: {dataHora(inicio)} → {dataHora(devolucao)}</span><span>Retirada real: {dataHora(locacao.retiradaReal)}</span><span>Devolução real: {dataHora(locacao.devolucaoReal ?? locacao.dataDevolucaoEfetiva)}</span><span>Diárias: {texto(locacao.qtdDiariasPrevistas)} previstas · {texto(locacao.qtdDiariasCobradas)} cobradas</span><span>Atendente: {texto(locacao.atendente?.nome || locacao.atendenteId)}</span></Campo>
                        <Campo titulo="Veículo"><span>{nomeVeiculo(veiculo)} · placa {texto(veiculo?.placa)}</span><span>Veículo #{texto(veiculo?.id)} · status {texto(veiculo?.status)}</span><span>Categoria: {texto(locacao.categoria?.nome || locacao.categoriaId)}</span></Campo>
                        <Campo titulo="Filiais e logística"><span>Retirada: {texto(locacao.filialRetirada?.nome || locacao.filialRetiradaId)}</span><span>Devolução: {texto(locacao.filialDevolucao?.nome || locacao.filialDevolucaoId)}</span><span>Entrega domiciliar: {locacao.entregaDomicilio ? 'Sim' : 'Não'} · {texto(locacao.enderecoEntrega)}</span><span>Coleta: {texto(locacao.enderecoColeta)}</span><span>Distância: {texto(locacao.distanciaEntregaKm)} km · voo: {texto(locacao.vooNumero)}</span></Campo>
                        <Campo titulo="Quilometragem e combustível"><span>KM saída / entrada: {texto(locacao.vistoriaSaida?.km ?? locacao.kmSaida)} / {texto(locacao.vistoriaEntrada?.km ?? locacao.kmEntrada)}</span><span>Franquia: {texto(locacao.kmFranquiaTotal)} km · excedente: {texto(locacao.kmExcedente)} km</span><span>Combustível saída / entrada: {texto(locacao.vistoriaSaida?.nivelCombustivel ?? locacao.combustivelSaida)}% / {texto(locacao.vistoriaEntrada?.nivelCombustivel ?? locacao.combustivelEntrada)}%</span></Campo>
                        <Campo titulo="Composição do preço"><span>Diária aplicada: {dinheiro(preco.valorDiariaAplicada)}</span><span>Subtotal das diárias: {dinheiro(preco.subtotalDiarias)}</span><span>Adicionais: {dinheiro(preco.totalAdicionais)} · proteções: {dinheiro(preco.totalProtecoes)}</span><span>Desconto: {dinheiro(preco.descontoTotal)} · impostos/taxas: {dinheiro(preco.impostosTaxas)}</span><span>Total congelado: {dinheiro(preco.valorTotal ?? locacao.valorTotal)}</span><span>Valor final cobrado: {dinheiro(locacao.valorFinalCobrado)}</span><span>Promoção/cupom ID: {texto(preco.promocaoId ?? locacao.promocaoId)}</span></Campo>
                        <Lista titulo="Pagamentos (histórico somente leitura)" itens={locacao.pagamentos} render={pagamento => `${texto(pagamento.tipo)} · ${dinheiro(pagamento.valor)} · ${texto(pagamento.status)} · ${pagamento.pagoEm ? `pago ${dataHora(pagamento.pagoEm)}` : `registrado ${dataHora(pagamento.createdAt)}`}`} />
                        <Campo titulo="Forma de pagamento e caução"><span>{texto(locacao.formaPagamento)}{locacao.parcelas ? ` · ${locacao.parcelas} parcela(s)` : ''}</span><span>Caução: {dinheiro(locacao.caucaoValor)} · status {texto(locacao.caucaoStatus)}</span></Campo>
                        <Lista titulo="Motoristas" itens={locacao.motoristas} render={motorista => `${nomeCliente(motorista.cliente)} · CPF ${texto(motorista.cliente?.cpf)} · ${motorista.principal ? 'principal' : 'adicional'}`} />
                        <Lista titulo="Adicionais" itens={locacao.adicionais} render={item => `${texto(item.adicional?.nome)} × ${texto(item.quantidade, '1')} · unitário ${dinheiro(item.valorUnitario)} · total ${dinheiro(item.valorTotal)}`} />
                        <Lista titulo="Proteções" itens={locacao.protecoes} render={item => `${texto(item.protecao?.nome)} · diária ${dinheiro(item.valorDiaria)} · total ${dinheiro(item.valorTotal)}`} />
                        <Lista titulo="Taxas e cobranças extras" itens={locacao.cobrancasExtras} render={item => `${texto(item.tipo)} · ${texto(item.descricao)} · ${dinheiro(item.valor)} · registrado ${dataHora(item.createdAt)}`} />
                        {admin && locacao.status === 'devolvida' && <CobrancaExtraForm locacao={locacao} processando={processandoId === locacao.id} onSubmit={onCobrancaExtra} />}
                        {renderVistoria('Vistoria de saída', locacao.vistoriaSaida, locacao.kmSaida, locacao.combustivelSaida)}
                        {renderVistoria('Vistoria de entrada', locacao.vistoriaEntrada, locacao.kmEntrada, locacao.combustivelEntrada)}
                        <Campo titulo="Cancelamento"><span>Cancelada em: {dataHora(locacao.canceladaEm)}</span><span>Motivo: {texto(locacao.motivoCancelamento)}</span><span>Multa calculada: {dinheiro(locacao.multaCancelamento)}</span></Campo>
                        <Campo titulo="Contrato"><span>{locacao.contratoAssinado ? `Assinado em ${dataHora(locacao.contratoAssinadoEm)}` : 'Não assinado'}</span>{locacao.contratoTexto ? <><details><summary>Visualizar snapshot do contrato</summary><pre>{locacao.contratoTexto}</pre></details><button type="button" className="botao botao-secundario" onClick={() => imprimirContrato(locacao.contratoTexto, locacao.codigo)}>Imprimir snapshot</button>{admin && <label className="locacao-switch"><input type="checkbox" checked={Boolean(locacao.contratoAssinado)} disabled={Boolean(locacao.contratoAssinado) || processandoId === locacao.id} onChange={evento => { if (evento.target.checked) onAssinarContrato(locacao); }} /><span>Registrar assinatura física do contrato</span></label>}</> : <span>Sem snapshot de contrato.</span>}</Campo>
                        <Lista titulo="Histórico de status" itens={locacao.historicoStatus} render={historico => `${texto(historico.statusAnterior)} → ${texto(historico.statusNovo)} · ${texto(historico.usuario?.nome || historico.usuarioId)} · ${dataHora(historico.alteradoEm)}`} />
                        <Campo titulo="Observações"><span>{texto(locacao.observacoes)}</span></Campo>
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
