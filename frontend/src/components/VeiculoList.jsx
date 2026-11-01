import { Link } from 'react-router-dom';
import PlateBadge from './PlateBadge';
import { formatarMoeda } from '../utils/format';

export default function VeiculoList({ veiculos }) {
  if (veiculos.length === 0) {
    return <p className="vazio">Nenhum veículo encontrado para este filtro. Cadastre um veículo no formulário acima.</p>;
  }

  return (
    <div className="grade-veiculos">
      {veiculos.map((veiculo) => (
        <article className="cartao-veiculo" key={veiculo.id}>
          <PlateBadge placa={veiculo.placa} />
          <div>
            <h3>
              {veiculo.marca} {veiculo.modelo}
            </h3>
            <div className="dados-veiculo">
              <span>Ano {veiculo.ano}</span>
              <span className="diaria">{formatarMoeda(veiculo.valorDiaria)} / dia</span>
            </div>
          </div>
          <div className="rodape-cartao">
            <span className={`selo ${veiculo.disponivel ? 'selo-livre' : 'selo-ocupado'}`}>
              {veiculo.disponivel ? 'Disponível' : 'Alugado'}
            </span>
            {veiculo.disponivel && (
              <Link className="botao botao-secundario" to={`/locacoes?veiculoId=${veiculo.id}`}>
                Alugar
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
