import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import * as locacaoService from "../services/locacaoService";
import * as veiculoService from "../services/veiculoService";
import { mensagemDeErro } from "../services/api";
import { formatarMoeda } from "../utils/format";
import Alert from "../components/Alert";
import LocacaoForm from "../components/LocacaoForm";
import LocacaoList from "../components/LocacaoList";

const labels = {
  retirar: "Retirada confirmada",
  iniciar: "Locação iniciada",
  devolver: "Devolução registrada",
  finalizar: "Locação finalizada",
  cancelar: "Locação cancelada",
};
export default function Locacoes() {
  const [searchParams] = useSearchParams();
  const [disponiveis, setDisponiveis] = useState([]),
    [locacoes, setLocacoes] = useState([]),
    [carregando, setCarregando] = useState(true),
    [processandoId, setProcessandoId] = useState(null),
    [alerta, setAlerta] = useState(null);
  const carregar = useCallback(async () => {
    try {
      const [listaVeiculos, listaLocacoes] = await Promise.all([
        veiculoService.listar("true"),
        locacaoService.listar(),
      ]);
      setDisponiveis(listaVeiculos);
      setLocacoes(listaLocacoes);
    } catch (erro) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(erro) });
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
        tipo: "sucesso",
        texto: `Locação registrada: ${locacao.veiculo.marca} ${locacao.veiculo.modelo}, total de ${formatarMoeda(locacao.valorTotal)}.`,
      });
      await carregar();
      return true;
    } catch (erro) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(erro) });
      await carregar();
      return false;
    }
  }
  async function executar(locacao, acao) {
    setAlerta(null);
    setProcessandoId(locacao.id);
    try {
      const resultado = await locacaoService.transicionar(locacao.id, acao);
      const multa =
        acao === "cancelar"
          ? ` Multa estimada: ${formatarMoeda(resultado.multaCancelamentoCalculada || 0)} (não cobrada pelo sistema).`
          : "";
      setAlerta({
        tipo: "sucesso",
        texto: `${labels[acao]} com sucesso.${multa}`,
      });
    } catch (erro) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(erro) });
    } finally {
      setProcessandoId(null);
      await carregar();
    }
  }
  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Locações</h1>
        <p className="apoio">
          Registre uma locação e acompanhe seu fluxo até a devolução e
          finalização.
        </p>
      </div>
      <Alert alerta={alerta} onFechar={() => setAlerta(null)} />
      {carregando ? (
        <p className="carregando-pagina">Carregando locações...</p>
      ) : (
        <>
          <LocacaoForm
            veiculos={disponiveis}
            veiculoInicial={searchParams.get("veiculoId")}
            onSubmit={registrar}
          />
          <h2>Histórico</h2>
          <LocacaoList
            locacoes={locacoes}
            processandoId={processandoId}
            onAcao={executar}
          />
        </>
      )}
    </>
  );
}
