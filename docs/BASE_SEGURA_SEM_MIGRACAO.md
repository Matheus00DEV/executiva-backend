# Base segura sem migracao de banco

Projeto: Executiva Agronegocios - Sistema de Frota, Pneus, Viagens e Acertos

Data: 08/06/2026

## Objetivo

Aplicar a primeira camada de seguranca do sistema sem alterar estrutura do banco de dados. Nesta fase o backend pode consultar e gravar nas tabelas que ja existem, mas nao deve criar tabela, adicionar coluna ou rodar migration automaticamente.

## O que foi implementado

- Middleware global de seguranca com `requestId` em todas as respostas.
- Headers mais seguros com Helmet, `Cache-Control: no-store` para API e remocao de `X-Powered-By`.
- CORS mais controlado por `CORS_ORIGINS`, `FRONTEND_ORIGIN` e URL do Render.
- Limite de JSON por `JSON_LIMIT`.
- Rate limit separado para API geral e login/cadastro.
- Validacao de `Content-Type` em POST/PUT/PATCH.
- Bloqueio de payload com chaves perigosas como `__proto__`, `prototype` e `constructor`.
- Limite de profundidade, tamanho de texto e quantidade de itens no payload.
- Validacao preventiva de metadados de anexos: extensao, tipo, nome e tamanho.
- Token JWT com `issuer`, `audience`, algoritmo fixo `HS256` e segredo obrigatorio em producao.
- Conferencia de usuario ativo a cada rota protegida, usando `AUTH_CHECK_USER_STATUS=true`.
- Frontend limpa a sessao e volta ao login quando a API informa sessao expirada, usuario bloqueado ou acesso inativo.
- Auto criacao/alteracao de tabelas bloqueada por padrao com `SCHEMA_SYNC_ENABLED=false`.
- Respostas de erro interno dos controllers principais nao expõem mais `error.message` em producao; o cliente recebe mensagem generica e `requestId` para rastreio.
- Listagem de motoristas, que inclui CPF/CNH/celular, agora exige perfil operacional no backend.

## Regra importante

`SCHEMA_SYNC_ENABLED` deve ficar `false` enquanto a logica do sistema nao estiver fechada.

So mudar para `true` quando:

- houver backup do banco;
- a migration for revisada;
- o responsavel tecnico aprovar;
- o deploy for feito em uma janela controlada.

## Variaveis recomendadas no Render

```env
NODE_ENV=production
JWT_SECRET=gere-uma-chave-grande-com-no-minimo-32-caracteres
JWT_EXPIRES_IN=12h
JWT_ISSUER=executiva-frota
JWT_AUDIENCE=executiva-frota-web
AUTH_CHECK_USER_STATUS=true
SCHEMA_SYNC_ENABLED=false
CORS_ORIGINS=https://executiva-backend.onrender.com
JSON_LIMIT=1mb
RATE_LIMIT_MAX=900
AUTH_RATE_LIMIT_MAX=30
MAX_ATTACHMENTS=5
MAX_ATTACHMENT_BYTES=10485760
```

## Anexos nesta fase

Ainda nao foi criado storage real nem tabela de anexos. O backend apenas valida metadados quando eles forem enviados, para impedir nomes perigosos, extensoes indevidas e arquivos grandes demais.

Fase seguinte:

- definir storage: S3, Cloudflare R2, Supabase Storage ou MinIO;
- criar endpoint de upload;
- salvar arquivo fora do banco;
- salvar no banco apenas metadados;
- gerar link assinado temporario para visualizacao;
- registrar auditoria de envio, aprovacao, devolucao e cancelamento.

## Observacao tecnica

Algumas rotinas antigas tinham sincronizacao automatica de estrutura. Elas agora ficam travadas por `SCHEMA_SYNC_ENABLED`. Se alguma tela depender de coluna que ainda nao existe, a decisao correta e revisar uma migration separada, nao deixar o servidor alterar o banco sozinho.
