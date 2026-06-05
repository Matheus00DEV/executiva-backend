const express = require('express');
const router = express.Router();
const pneuController = require('../controllers/pneuController');
const { exigirAutenticacao, exigirPermissaoCadastro } = require('../middleware/authMiddleware');

router.use(exigirAutenticacao);
router.get('/', pneuController.getPneus);
router.post('/', exigirPermissaoCadastro, pneuController.criarPneu);

module.exports = router;
