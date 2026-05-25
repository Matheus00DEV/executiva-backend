require('dotenv').config();
const { Client } = require('pg');

const requiredEnv = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length) {
  console.error(`Variaveis ausentes no .env: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

console.log('Tentando conectar ao banco...');
client.connect()
  .then(() => {
    console.log('CONECTADO COM SUCESSO!');
    return client.query('SELECT 1 as test');
  })
  .then(res => {
    console.log('Query OK:', res.rows);
    return client.end();
  })
  .catch(err => {
    console.error('ERRO DE CONEXAO:', err.message);
    console.error('Detalhes:', JSON.stringify({
      code: err.code,
      routine: err.routine,
      severity: err.severity
    }));
    return client.end().catch(() => {});
  });
