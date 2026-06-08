require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const db = require('./config/db');
const { validarConfiguracaoToken } = require('./utils/token');
const {
  requestContext,
  noStoreApi,
  exigirContentTypeValido,
  protegerPayload
} = require('./middleware/securityMiddleware');
const motoristaRoutes = require('./routes/motoristaRoutes');
const pneuRoutes = require('./routes/pneuRoutes');
const movimentacaoRoutes = require('./routes/movimentacaoRoutes');
const veiculoRoutes = require('./routes/veiculoRoutes');
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const conferenciaRoutes = require('./routes/conferenciaRoutes');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = [
  ...(process.env.CORS_ORIGINS || '').split(','),
  ...(process.env.FRONTEND_ORIGIN || '').split(','),
  process.env.RENDER_EXTERNAL_URL || ''
]
  .map(origin => origin.trim())
  .filter(Boolean);

validarConfiguracaoToken();

// Middlewares
app.use(requestContext);
app.set('trust proxy', isProduction ? 1 : false);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'same-origin' },
  strictTransportSecurity: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false
}));
app.use(compression());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token', 'X-Request-Id'],
  optionsSuccessStatus: 204
}));
app.use('/api', noStoreApi);
app.use(exigirContentTypeValido);
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.JSON_LIMIT || '1mb' }));
app.use(protegerPayload);

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_MAX || 900),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes. Tente novamente em alguns minutos.' }
});

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de acesso. Aguarde alguns minutos.' }
});

app.use('/api', apiLimiter);

// Servir arquivos estáticos do frontend (pasta raiz do projeto)
const frontendRoot = fs.existsSync(path.join(__dirname, '..', 'pages'))
  ? path.join(__dirname, '..')
  : __dirname;
app.use('/assets', express.static(path.join(frontendRoot, 'assets')));
app.use('/pages', express.static(path.join(frontendRoot, 'pages')));

// Rota raiz redireciona para login
app.get('/', (req, res) => {
  res.redirect('/pages/login.html');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'executiva-frota-api',
    env: process.env.NODE_ENV || 'development',
    uptime: Math.round(process.uptime())
  });
});

app.get('/api/health/db', async (req, res, next) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(error);
  }
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/motoristas', motoristaRoutes);
app.use('/api/pneus', pneuRoutes);
app.use('/api/movimentacoes', movimentacaoRoutes);
app.use('/api/veiculos', veiculoRoutes);
app.use('/api/conferencias', conferenciaRoutes);

// Tratamento de Rota não encontrada (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada', requestId: req.id });
});

// Tratamento de erros globais (500)
app.use((err, req, res, next) => {
  console.error(`[${req.id || 'sem-request-id'}]`, err.stack || err);
  res.status(err.status || 500).json({
    error: err.status ? err.message : 'Erro interno no servidor',
    requestId: req.id,
    ...(isProduction ? {} : { details: err.message })
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`API acessível em http://localhost:${PORT}/api`);
});
