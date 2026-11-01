const app = require('./app');
const { getJwtSecret } = require('./lib/jwtConfig');

getJwtSecret();

const porta = process.env.PORT || 3333;
const host = process.env.HOST || '127.0.0.1';

app.listen(porta, host, () => {
  console.log(`API em execução em ${host}:${porta}`);
});
