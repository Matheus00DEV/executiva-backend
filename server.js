require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const motoristaRoutes = require('./routes/motoristaRoutes');
const pneuRoutes = require('./routes/pneuRoutes');
const movimentacaoRoutes = require('./routes/movimentacaoRoutes');
const veiculoRoutes = require('./routes/veiculoRoutes');
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true
}));
app.use(express.json());

// Servir arquivos estáticos do frontend (pasta raiz do projeto)
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use('/pages', express.static(path.join(__dirname, '..', 'pages')));

// Rota raiz redireciona para login
app.get('/', (req, res) => {
  res.redirect('/pages/login.html');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/motoristas', motoristaRoutes);
app.use('/api/pneus', pneuRoutes);
app.use('/api/movimentacoes', movimentacaoRoutes);
app.use('/api/veiculos', veiculoRoutes);

// Tratamento de Rota não encontrada (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Tratamento de erros globais (500)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno no servidor' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`API acessível em http://localhost:${PORT}/api`);
});
