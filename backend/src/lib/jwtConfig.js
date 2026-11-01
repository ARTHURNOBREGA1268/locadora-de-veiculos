const JWT_SECRET_MIN_LENGTH = 32;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (typeof secret !== 'string' || secret.trim().length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(`JWT_SECRET deve ter pelo menos ${JWT_SECRET_MIN_LENGTH} caracteres`);
  }

  return secret;
}

module.exports = { getJwtSecret };
