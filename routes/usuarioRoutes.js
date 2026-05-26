const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { exigirAutenticacao, exigirAdmin } = require('../middleware/authMiddleware');

router.use(exigirAutenticacao, exigirAdmin);

router.get('/', usuarioController.listarUsuarios);
router.post('/', usuarioController.criarUsuarioDireto);
router.put('/:id', usuarioController.atualizarUsuario);
router.put('/:id/status', usuarioController.atualizarStatusUsuario);
router.put('/:id/senha', usuarioController.alterarSenha);
router.delete('/:id', usuarioController.excluirUsuario);

module.exports = router;
