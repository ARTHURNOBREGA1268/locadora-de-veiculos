require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const veiculoRoutes = require('./routes/veiculo.routes');
const locacaoRoutes = require('./routes/locacao.routes');
const { naoEncontrado, tratarErros } = require('./middlewares/error.middleware');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/veiculos', veiculoRoutes);
app.use('/locacoes', locacaoRoutes);

app.use(naoEncontrado);
app.use(tratarErros);

module.exports = app;
