const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { exigirAutenticacao, exigirAdmin } = require('../middleware/authMiddleware');

router.use(exigirAutenticacao);

router.get('/', usuarioController.listarUsuarios);
router.put('/me', usuarioController.atualizarMeuAcesso);
router.post('/', exigirAdmin, usuarioController.criarUsuarioDireto);
router.put('/:id', exigirAdmin, usuarioController.atualizarUsuario);
router.put('/:id/status', exigirAdmin, usuarioController.atualizarStatusUsuario);
router.put('/:id/perfil', exigirAdmin, usuarioController.atualizarPerfilUsuario);
router.put('/:id/permissoes', exigirAdmin, usuarioController.atualizarPermissoes);
router.put('/:id/senha', exigirAdmin, usuarioController.alterarSenha);
router.delete('/:id', exigirAdmin, usuarioController.excluirUsuario);

module.exports = router;
