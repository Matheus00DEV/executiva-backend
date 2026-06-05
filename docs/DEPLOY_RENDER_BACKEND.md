# Deploy do backend no Render

Este projeto agora esta preparado para subir o backend pelo GitHub usando Render Blueprint (`render.yaml` na raiz do repositorio).

## O que foi preparado

- Backend Node/Express em `backend/`.
- `render.yaml` na raiz, apontando `rootDir: backend`.
- Build com `npm ci`.
- Checagem pre-deploy com `npm run check`.
- Start com `npm start`.
- Health check em `/api/health`.
- Banco por `DATABASE_URL`, compativel com Render Postgres, Supabase, Neon e outros Postgres gerenciados.
- `JWT_SECRET` gerado pelo Render, sem segredo salvo no GitHub.
- Rotas operacionais protegidas por login.
- Limite de tentativas no login e limite geral de requisicoes.
- Headers de seguranca com Helmet.
- CORS por lista de origens.

## Arquivos importantes

- `render.yaml`: configuracao para o Render criar o web service e o banco.
- `backend/package.json`: scripts de producao.
- `backend/.env.example`: modelo de variaveis locais, sem segredo real.
- `backend/config/db.js`: conexao com `DATABASE_URL` ou variaveis separadas.
- `backend/utils/token.js`: JWT com segredo obrigatorio em producao.
- `.gitignore`: ja ignora `.env` e `node_modules`.

## Subir pelo GitHub

1. Suba o repositorio para o GitHub.
2. No Render, crie um novo Blueprint apontando para o repositorio.
3. Confirme que o Render encontrou o `render.yaml`.
4. O Render deve criar:
   - Web service `executiva-frota-backend`.
   - Postgres `executiva-frota-db`.
5. Depois do primeiro deploy, teste:
   - `https://SEU-SERVICO.onrender.com/api/health`
   - `https://SEU-SERVICO.onrender.com/pages/login.html`

## Variaveis de ambiente

O Blueprint gera ou injeta automaticamente:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN=12h`
- `JWT_ISSUER=executiva-frota`

Se o frontend estiver em outro dominio, configure no Render:

```txt
CORS_ORIGINS=https://seu-front.com,https://outro-dominio.com
```

Se usar Supabase/Neon ou uma URL externa que exija SSL:

```txt
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

Para Render Postgres interno criado pelo Blueprint, pode manter:

```txt
DB_SSL=false
```

## Comandos locais

Dentro de `backend/`:

```bash
npm install
npm run check
npm run test:db
npm run dev
```

## Primeiro acesso

O primeiro usuario cadastrado no sistema vira administrador automaticamente. Depois disso, novos acessos entram como pendentes e precisam ser aprovados.

## Observacoes para anexos

Nao salve fotos/documentos no disco do Render como solucao definitiva, porque web service pode reiniciar e o disco comum nao e ideal para arquivos de usuario. Para anexos de motorista, use armazenamento externo:

- Supabase Storage
- Cloudflare R2
- AWS S3

O banco deve guardar apenas metadados do arquivo, como nome, tipo, URL/chave do storage, usuario, viagem/acerto vinculado e status de aprovacao.

## Referencias oficiais

- Render Node/Express: https://render.com/docs/deploy-node-express-app
- Render Blueprint: https://render.com/docs/blueprint-spec
- Render Postgres: https://render.com/docs/postgresql-creating-connecting
