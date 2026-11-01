import PlateBadge from './PlateBadge';
import { formatarDataHora, formatarMoeda } from '../utils/format';

export default function LocacaoList({ locacoes, finalizandoId, onFinalizar }) {
  if (locacoes.length === 0) {
    return <p className="vazio">Você ainda não tem locações. Registre a primeira no formulário acima.</p>;
  }

  return (
    <div className="lista-locacoes">
      {locacoes.map((locacao) => {
        const ativa = locacao.status === 'ATIVA';
        return (
          <article className="cartao-locacao" key={locacao.id}>
            <PlateBadge placa={locacao.veiculo.placa} />
            <div className="detalhes-locacao">
              <h3>
                {locacao.veiculo.marca} {locacao.veiculo.modelo}
              </h3>
              <span>Retirada: {formatarDataHora(locacao.dataInicio)}</span>
              <span>Devolução prevista: {formatarDataHora(locacao.dataPrevistaDevolucao)}</span>
              {locacao.dataDevolucaoEfetiva && <span>Devolvido em: {formatarDataHora(locacao.dataDevolucaoEfetiva)}</span>}
            </div>
            <div className="lado-locacao">
              <span className="valor">{formatarMoeda(locacao.valorTotal)}</span>
              <span className={`selo ${ativa ? 'selo-ocupado' : 'selo-livre'}`}>{ativa ? 'Ativa' : 'Finalizada'}</span>
              {ativa && (
                <button type="button" className="botao botao-secundario" disabled={finalizandoId === locacao.id} onClick={() => onFinalizar(locacao.id)}>
                  {finalizandoId === locacao.id ? 'Finalizando...' : 'Finalizar locação'}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
