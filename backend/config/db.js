const { Pool } = require('pg');
require('dotenv').config();

function boolEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'sim'].includes(String(value).trim().toLowerCase());
}

function buildPoolConfig() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const requiredEnv = hasDatabaseUrl ? [] : ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingEnv = requiredEnv.filter(key => !process.env[key]);

  if (missingEnv.length) {
    throw new Error(`Variaveis de ambiente ausentes: ${missingEnv.join(', ')}`);
  }

  const baseConfig = hasDatabaseUrl
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      };

  const sslEnabled = boolEnv(process.env.DB_SSL, false);

  return {
    ...baseConfig,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
    ssl: sslEnabled ? { rejectUnauthorized: boolEnv(process.env.DB_SSL_REJECT_UNAUTHORIZED, false) } : undefined
  };
}

const pool = new Pool(buildPoolConfig());

pool.on('error', err => {
  console.error('Erro inesperado em conexao ociosa do Postgres:', err);
});

async function closePool() {
  await pool.end();
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  closePool,
  pool
};
