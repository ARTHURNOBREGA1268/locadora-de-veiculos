import { useState } from 'react';

const vazio = { marca: '', modelo: '', placa: '', ano: '', valorDiaria: '' };

export default function VeiculoForm({ onSubmit }) {
  const [campos, setCampos] = useState(vazio);
  const [enviando, setEnviando] = useState(false);

  function alterar(evento) {
    setCampos({ ...campos, [evento.target.name]: evento.target.value });
  }

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    const sucesso = await onSubmit({
      marca: campos.marca,
      modelo: campos.modelo,
      placa: campos.placa,
      ano: Number(campos.ano),
      valorDiaria: Number(campos.valorDiaria)
    });
    setEnviando(false);
    if (sucesso) setCampos(vazio);
  }

  return (
    <form className="painel formulario" onSubmit={enviar}>
      <h2>Cadastrar veículo</h2>
      <div className="grade-campos">
        <label>
          Marca
          <input name="marca" value={campos.marca} onChange={alterar} required />
        </label>
        <label>
          Modelo
          <input name="modelo" value={campos.modelo} onChange={alterar} required />
        </label>
        <label>
          Placa
          <input name="placa" value={campos.placa} onChange={alterar} maxLength={8} required />
        </label>
        <label>
          Ano
          <input name="ano" type="number" min="1900" value={campos.ano} onChange={alterar} required />
        </label>
        <label>
          Valor da diária (R$)
          <input name="valorDiaria" type="number" min="0.01" step="0.01" value={campos.valorDiaria} onChange={alterar} required />
        </label>
      </div>
      <div className="acoes-formulario">
        <button type="submit" className="botao botao-principal" disabled={enviando}>
          {enviando ? 'Salvando...' : 'Cadastrar veículo'}
        </button>
      </div>
    </form>
  );
}
