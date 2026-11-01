const app = require('./app');
const { getJwtSecret } = require('./lib/jwtConfig');

getJwtSecret();

const porta = process.env.PORT || 3333;

app.listen(porta, () => {
  console.log(`API em execução na porta ${porta}`);
});
