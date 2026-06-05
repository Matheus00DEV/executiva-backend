const express = require('express');
const router = express.Router();
const conferenciaController = require('../controllers/conferenciaController');
const { exigirAutenticacao } = require('../middleware/authMiddleware');

router.use(exigirAutenticacao);

router.get('/', conferenciaController.listar);
router.post('/', conferenciaController.criar);
router.put('/:id/status', conferenciaController.atualizarStatus);

module.exports = router;
