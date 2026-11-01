const app = require('./app');

const porta = process.env.PORT || 3333;

app.listen(porta, () => {
  console.log(`API em execução na porta ${porta}`);
});
