import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import * as locacaoService from '../services/locacaoService';
import * as veiculoService from '../services/veiculoService';
import * as clienteService from '../services/clienteService';
import { mensagemDeErro } from '../services/api';
import { formatarMoeda } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import LocacaoForm from '../components/LocacaoForm';
import LocacaoList from '../components/LocacaoList';

const labels = {
  retirar: 'Retirada confirmada',
  iniciar: 'Locação iniciada',
  devolver: 'Devolução registrada',
  finalizar: 'Locação finalizada',
  cancelar: 'Locação cancelada',
};

const vistoriaInicial = { km: '', nivelCombustivel: '', observacoes: '', itensChecklist: [] };

export default function Locacoes() {
  const [searchParams] = useSearchParams();
  const { usuario } = useAuth();
  const admin = usuario?.papel === 'ADMIN';
  const [disponiveis, setDisponiveis] = useState([]);
  const [locacoes, setLocacoes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [processandoId, setProcessandoId] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [vistoria, setVistoria] = useState(vistoriaInicial);
  const [motivo, setMotivo] = useState('');
  const dialogRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const [veiculos, reservas] = await Promise.all([veiculoService.listar(), locacaoService.listar()]);
      setDisponiveis(admin
        ? veiculos.filter(item => !['inativo', 'manutencao'].includes(item.status))
        : veiculos.filter(item => item.status === 'disponivel'));
      setLocacoes(reservas);
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
    } finally {
      setCarregando(false);
    }
  }, [admin]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (admin) {
      clienteService.listar({ ativo: true })
        .then(dados => setClientes(Array.isArray(dados) ? dados : []))
        .catch(erro => setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) }));
    }
  }, [admin]);
  useEffect(() => {
    if (dialogo) dialogRef.current?.showModal();
    else if (dialogRef.current?.open) dialogRef.current.close();
  }, [dialogo]);

  async function registrar(dados) {
    setAlerta(null);
    try {
      const locacao = await locacaoService.registrar(dados);
      setAlerta({ tipo: 'sucesso', texto: `Locação registrada: ${locacao.veiculo?.marca || ''} ${locacao.veiculo?.modelo || ''}, total de ${formatarMoeda(locacao.valorTotal)}.` });
      await carregar();
      return true;
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
      await carregar();
      return false;
    }
  }

  async function registrarCobrancaExtra(locacao, dados) {
    setAlerta(null);
    setProcessandoId(locacao.id);
    try {
      await locacaoService.registrarCobrancaExtra(locacao.id, dados);
      setAlerta({ tipo: 'sucesso', texto: 'Cobrança extra registrada como saldo pendente; nenhum pagamento foi processado.' });
      return true;
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
      return false;
    } finally {
      setProcessandoId(null);
      await carregar();
    }
  }

  async function marcarContratoAssinado(locacao) {
    setAlerta(null);
    setProcessandoId(locacao.id);
    try {
      await locacaoService.marcarContratoAssinado(locacao.id);
      setAlerta({ tipo: 'sucesso', texto: 'Assinatura registrada no snapshot do contrato.' });
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
    } finally {
      setProcessandoId(null);
      await carregar();
    }
  }

  async function abrirDialogo(locacao, acao) {
    if (acao !== 'retirar' && acao !== 'devolver' && acao !== 'cancelar') {
      setAlerta(null);
      setProcessandoId(locacao.id);
      try {
        await locacaoService.transicionar(locacao.id, acao, {});
        setAlerta({ tipo: 'sucesso', texto: `${labels[acao]} com sucesso.` });
      } catch (erro) {
        setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
      } finally {
        setProcessandoId(null);
        await carregar();
      }
      return;
    }

    setAlerta(null);
    setVistoria(vistoriaInicial);
    setMotivo('');
    if (acao === 'retirar' || acao === 'devolver') {
      try {
        const itens = await locacaoService.listarChecklist();
        setVistoria({
          ...vistoriaInicial,
          itensChecklist: (Array.isArray(itens) ? itens : []).map(item => ({
            itemId: item.id,
            descricao: item.descricao,
            obrigatorio: item.obrigatorio,
            conforme: null,
          })),
        });
      } catch (erro) {
        setAlerta({ tipo: 'erro', texto: `Não foi possível carregar o checklist: ${mensagemDeErro(erro)}` });
        return;
      }
    }
    setDialogo({ locacao, acao });
  }

  async function executar(body = {}) {
    const { locacao, acao } = dialogo;
    setAlerta(null);
    setProcessandoId(locacao.id);
    setDialogo(null);
    try {
      const resultado = await locacaoService.transicionar(locacao.id, acao, body);
      const multa = acao === 'cancelar'
        ? ` Multa calculada de ${formatarMoeda(resultado?.multaCancelamentoCalculada ?? resultado?.multaCancelamento ?? 0)} registrada como valor informativo/pendente; nenhum pagamento foi processado.`
        : '';
      setAlerta({ tipo: 'sucesso', texto: `${labels[acao]} com sucesso.${multa}` });
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
    } finally {
      setProcessandoId(null);
      await carregar();
    }
  }

  function confirmarDialogo(evento) {
    evento.preventDefault();
    if (!dialogo) return;
    if (dialogo.acao === 'cancelar') {
      if (motivo.trim()) void executar({ motivoCancelamento: motivo.trim() });
      return;
    }

    const km = Number(vistoria.km);
    const nivelCombustivel = Number(vistoria.nivelCombustivel);
    if (!Number.isInteger(km) || km < 0 || !Number.isInteger(nivelCombustivel) || nivelCombustivel < 0 || nivelCombustivel > 100) return;
    if (vistoria.itensChecklist.some(item => item.obrigatorio && item.conforme === null)) {
      setAlerta({ tipo: 'erro', texto: 'Responda todos os itens obrigatórios do checklist.' });
      return;
    }
    const itensChecklist = vistoria.itensChecklist
      .filter(item => item.conforme !== null)
      .map(({ itemId, conforme }) => ({ itemId, conforme }));
    void executar({ vistoria: { km, nivelCombustivel, observacoes: vistoria.observacoes.trim(), itensChecklist } });
  }

  function atualizarRespostaChecklist(itemId, valor) {
    setVistoria(atual => ({
      ...atual,
      itensChecklist: atual.itensChecklist.map(item => item.itemId === itemId
        ? { ...item, conforme: valor === '' ? null : valor === 'true' }
        : item),
    }));
  }

  return <>
    <div className="cabecalho-pagina"><h1>Locações</h1><p className="apoio">Registre reservas e acompanhe períodos, cobranças informativas e transições do processo.</p></div>
    <Alert alerta={alerta} onFechar={() => setAlerta(null)} />
    {carregando ? <p className="carregando-pagina">Carregando locações...</p> : <>
      <LocacaoForm veiculos={disponiveis} veiculoInicial={searchParams.get('veiculoId')} onSubmit={registrar} admin={admin} clientes={clientes} />
      <div className="locacoes-historico-titulo"><h2>Histórico de locações</h2><p className="apoio">Pagamentos e caução são apresentados como histórico/pendência. Nenhuma cobrança é processada nesta tela.</p></div>
      <LocacaoList locacoes={locacoes} processandoId={processandoId} onAcao={abrirDialogo} admin={admin} onCobrancaExtra={registrarCobrancaExtra} onAssinarContrato={marcarContratoAssinado} />
    </>}

    <dialog ref={dialogRef} className="locacao-dialogo" aria-labelledby="locacao-dialogo-titulo" onCancel={() => setDialogo(null)} onClose={() => setDialogo(null)}>
      {dialogo && <form onSubmit={confirmarDialogo} className="formulario">
        <h2 id="locacao-dialogo-titulo">{dialogo.acao === 'cancelar' ? 'Cancelar locação' : dialogo.acao === 'retirar' ? 'Vistoria de retirada' : 'Vistoria de devolução'}</h2>
        {dialogo.acao === 'cancelar' ? <label>Motivo do cancelamento<textarea required maxLength={255} autoFocus rows="4" value={motivo} onChange={evento => setMotivo(evento.target.value)} /></label> : <>
          <div className="grade-campos">
            <label>Odômetro (km)<input autoFocus type="number" min="0" step="1" required value={vistoria.km} onChange={evento => setVistoria(atual => ({ ...atual, km: evento.target.value }))} /></label>
            <label>Nível de combustível (%)<input type="number" min="0" max="100" step="1" required value={vistoria.nivelCombustivel} onChange={evento => setVistoria(atual => ({ ...atual, nivelCombustivel: evento.target.value }))} /></label>
          </div>
          {vistoria.itensChecklist.length > 0 ? <fieldset className="locacao-checklist">
            <legend>Checklist de {dialogo.acao === 'retirar' ? 'retirada' : 'devolução'}</legend>
            {vistoria.itensChecklist.map(item => <label key={item.itemId}>
              {item.descricao}{item.obrigatorio ? ' *' : ''}
              <select required={item.obrigatorio} value={item.conforme === null ? '' : String(item.conforme)} onChange={evento => atualizarRespostaChecklist(item.itemId, evento.target.value)}>
                <option value="">Selecione</option><option value="true">Conforme</option><option value="false">Não conforme</option>
              </select>
            </label>)}
            <small>* Resposta obrigatória. Itens não conformes são registrados, não bloqueiam a vistoria.</small>
          </fieldset> : <p className="apoio">Nenhum item de checklist ativo foi configurado.</p>}
          <label>Observações da vistoria<textarea rows="4" maxLength={5000} value={vistoria.observacoes} onChange={evento => setVistoria(atual => ({ ...atual, observacoes: evento.target.value }))} /></label>
        </>}
        <div className="locacao-dialogo-acoes"><button type="button" className="botao botao-secundario" onClick={() => setDialogo(null)}>Voltar</button><button type="submit" className="botao botao-principal">{dialogo.acao === 'cancelar' ? 'Confirmar cancelamento' : 'Salvar vistoria e continuar'}</button></div>
      </form>}
    </dialog>
  </>;
}
