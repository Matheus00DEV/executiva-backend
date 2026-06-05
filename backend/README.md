# Executiva Frota Backend

API Node/Express para gestao de pneus, frota, usuarios e conferencias.

## Rodar localmente

```bash
npm install
cp .env.example .env
npm run check
npm run test:db
npm run dev
```

No Windows, copie `backend/.env.example` para `backend/.env` manualmente e ajuste as variaveis.

## Deploy no Render

O deploy esta descrito em `../docs/DEPLOY_RENDER_BACKEND.md`.

Resumo:

- `buildCommand`: `npm ci`
- `preDeployCommand`: `npm run check`
- `startCommand`: `npm start`
- `healthCheckPath`: `/api/health`

## Seguranca

- Nunca suba `.env` para o GitHub.
- Em producao, configure `JWT_SECRET` com pelo menos 32 caracteres.
- Use `DATABASE_URL` para banco gerenciado.
- Configure `CORS_ORIGINS` se o frontend estiver em outro dominio.
