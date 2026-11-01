import { useState } from 'react';
import { paraInputLocal } from '../utils/format';

export default function LocacaoForm({ veiculos, veiculoInicial, onSubmit }) {
  const [veiculoId, setVeiculoId] = useState(veiculoInicial || '');
  const [dataInicio, setDataInicio] = useState(() => paraInputLocal(new Date()));
  const [dataDevolucao, setDataDevolucao] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    const sucesso = await onSubmit({
      veiculoId: Number(veiculoId),
      dataInicio: new Date(dataInicio).toISOString(),
      dataPrevistaDevolucao: new Date(dataDevolucao).toISOString()
    });
    setEnviando(false);
    if (sucesso) {
      setVeiculoId('');
      setDataInicio(paraInputLocal(new Date()));
      setDataDevolucao('');
    }
  }

  return (
    <form className="painel formulario" onSubmit={enviar}>
      <h2>Nova locação</h2>
      <div className="grade-campos">
        <label>
          Veículo disponível
          <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} required>
            <option value="">Selecione um veículo</option>
            {veiculos.map((veiculo) => (
              <option key={veiculo.id} value={veiculo.id}>
                {veiculo.marca} {veiculo.modelo} - {veiculo.placa}
              </option>
            ))}
          </select>
        </label>
        <label>
          Retirada
          <input type="datetime-local" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
        </label>
        <label>
          Devolução prevista
          <input type="datetime-local" value={dataDevolucao} min={dataInicio} onChange={(e) => setDataDevolucao(e.target.value)} required />
        </label>
      </div>
      <div className="acoes-formulario">
        <button type="submit" className="botao botao-principal" disabled={enviando || veiculos.length === 0}>
          {enviando ? 'Registrando...' : 'Registrar locação'}
        </button>
      </div>
      {veiculos.length === 0 && <p className="apoio">Não há veículos disponíveis no momento.</p>}
    </form>
  );
}
