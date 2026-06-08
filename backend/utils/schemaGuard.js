const { boolEnv } = require('./env');

const avisosEmitidos = new Set();

function schemaSyncEnabled() {
  return boolEnv(process.env.SCHEMA_SYNC_ENABLED, false);
}

async function executarSchemaSync(nome, tarefa) {
  if (!schemaSyncEnabled()) {
    if (!avisosEmitidos.has(nome)) {
      avisosEmitidos.add(nome);
      console.warn(`[schema-sync] ${nome}: sincronizacao de estrutura desativada. Use SCHEMA_SYNC_ENABLED=true somente quando quiser autorizar migration.`);
    }
    return false;
  }

  await tarefa();
  return true;
}

module.exports = {
  schemaSyncEnabled,
  executarSchemaSync
};
