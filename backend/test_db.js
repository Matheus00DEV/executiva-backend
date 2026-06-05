require('dotenv').config();
const db = require('./config/db');

async function main() {
  try {
    console.log('Tentando conectar ao banco...');
    const result = await db.query('SELECT 1 AS test');
    console.log('CONECTADO COM SUCESSO!');
    console.log('Query OK:', result.rows);
  } catch (error) {
    console.error('ERRO DE CONEXAO:', error.message);
    console.error('Detalhes:', JSON.stringify({
      code: error.code,
      routine: error.routine,
      severity: error.severity
    }));
    process.exitCode = 1;
  } finally {
    await db.closePool().catch(() => {});
  }
}

main();
