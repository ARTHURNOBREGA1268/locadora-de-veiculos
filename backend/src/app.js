require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const veiculoRoutes = require('./routes/veiculo.routes');
const locacaoRoutes = require('./routes/locacao.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const configuracaoRoutes = require('./routes/configuracao.routes');
const { naoEncontrado, tratarErros } = require('./middlewares/error.middleware');
const app = express();
const origensPermitidas = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origem, callback) => {
    if (!origem || origensPermitidas.includes(origem)) {
      return callback(null, true);
    }
    return callback(null, false);
  }
}));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/veiculos', veiculoRoutes);
app.use('/locacoes', locacaoRoutes);
app.use('/usuarios', usuarioRoutes);
app.use('/configuracoes', configuracaoRoutes);

app.use(naoEncontrado);
app.use(tratarErros);

module.exports = app;
