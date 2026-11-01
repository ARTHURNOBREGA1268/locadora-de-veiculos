import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as locacaoService from '../services/locacaoService';
import * as veiculoService from '../services/veiculoService';
import { mensagemDeErro } from '../services/api';
import { formatarMoeda } from '../utils/format';
import Alert from '../components/Alert';
import LocacaoForm from '../components/LocacaoForm';
import LocacaoList from '../components/LocacaoList';

export default function Locacoes() {
  const [searchParams] = useSearchParams();
  const [disponiveis, setDisponiveis] = useState([]);
  const [locacoes, setLocacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [finalizandoId, setFinalizandoId] = useState(null);
  const [alerta, setAlerta] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const [listaVeiculos, listaLocacoes] = await Promise.all([veiculoService.listar('true'), locacaoService.listar()]);
      setDisponiveis(listaVeiculos);
      setLocacoes(listaLocacoes);
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function registrar(dados) {
    setAlerta(null);
    try {
      const locacao = await locacaoService.registrar(dados);
      setAlerta({
        tipo: 'sucesso',
        texto: `Locação registrada: ${locacao.veiculo.marca} ${locacao.veiculo.modelo}, total de ${formatarMoeda(locacao.valorTotal)}.`
      });
      await carregar();
      return true;
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
      await carregar();
      return false;
    }
  }

  async function finalizar(id) {
    setAlerta(null);
    setFinalizandoId(id);
    try {
      const locacao = await locacaoService.finalizar(id);
      setAlerta({ tipo: 'sucesso', texto: `Locação finalizada: ${locacao.veiculo.marca} ${locacao.veiculo.modelo} devolvido.` });
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
    } finally {
      setFinalizandoId(null);
      await carregar();
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Locações</h1>
        <p className="apoio">Registre uma locação, acompanhe o histórico e finalize quando o veículo for devolvido.</p>
      </div>
      <Alert alerta={alerta} onFechar={() => setAlerta(null)} />
      {carregando ? (
        <p className="carregando-pagina">Carregando locações...</p>
      ) : (
        <>
          <LocacaoForm veiculos={disponiveis} veiculoInicial={searchParams.get('veiculoId')} onSubmit={registrar} />
          <h2>Histórico</h2>
          <LocacaoList locacoes={locacoes} finalizandoId={finalizandoId} onFinalizar={finalizar} />
        </>
      )}
    </>
  );
}
