const db = require('../config/db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/token');

const PERFIS = ['admin', 'operacional', 'motorista'];
const STATUS = ['pendente', 'aprovado', 'recusado', 'bloqueado'];

let tableReadyPromise = null;

function normalizarUsuario(usuario) {
  return String(usuario || '').trim().toLowerCase();
}

function normalizarPerfil(perfil) {
  const normalizado = String(perfil || '').trim().toLowerCase();
  return PERFIS.includes(normalizado) ? normalizado : 'motorista';
}

function normalizarStatus(status) {
  const normalizado = String(status || '').trim().toLowerCase();
  return STATUS.includes(normalizado) ? normalizado : '';
}

function usuarioPublico(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    nome: row.nome,
    usuario: row.usuario,
    perfil: row.perfil,
    status: row.status,
    ativo: row.status === 'aprovado',
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    aprovadoEm: row.aprovado_em,
    aprovadoPor: row.aprovado_por,
    recusadoEm: row.recusado_em,
    ultimoLogin: row.ultimo_login,
    podeCadastrar: row.pode_cadastrar !== false,
    podeRelatorios: row.pode_relatorios !== false
  };
}

function usuarioEhAdmin(usuario) {
  return ['admin', 'administrador'].includes(String(usuario?.perfil || '').toLowerCase());
}

function permissaoPadrao(perfil, permissao) {
  const perfilNormalizado = normalizarPerfil(perfil);
  if (perfilNormalizado === 'motorista') return false;
  return ['cadastro', 'relatorios'].includes(permissao);
}

function validarCadastro({ nome, usuario, senha }) {
  const erros = [];
  if (!String(nome || '').trim()) erros.push('Informe o nome.');
  if (!usuario) erros.push('Informe o usuario.');
  if (usuario && !/^[a-z0-9._-]{3,60}$/.test(usuario)) {
    erros.push('Usuario deve ter 3 a 60 caracteres e usar apenas letras, numeros, ponto, traco ou underline.');
  }
  if (!String(senha || '').trim()) erros.push('Informe a senha.');
  if (String(senha || '').length < 4) erros.push('Use uma senha com pelo menos 4 caracteres.');
  return erros;
}

async function garantirTabelaUsuarios() {
  if (!tableReadyPromise) {
    tableReadyPromise = db.query(`
      CREATE TABLE IF NOT EXISTS gestao_de_pneu (
        id BIGSERIAL PRIMARY KEY,
        nome VARCHAR(120) NOT NULL,
        usuario VARCHAR(60) NOT NULL UNIQUE,
        senha_hash TEXT NOT NULL,
        perfil VARCHAR(20) NOT NULL DEFAULT 'motorista',
        status VARCHAR(20) NOT NULL DEFAULT 'pendente',
        aprovado_por BIGINT REFERENCES gestao_de_pneu(id),
        aprovado_em TIMESTAMP,
        recusado_em TIMESTAMP,
        ultimo_login TIMESTAMP,
        pode_cadastrar BOOLEAN NOT NULL DEFAULT TRUE,
        pode_relatorios BOOLEAN NOT NULL DEFAULT TRUE,
        criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_perfil_gestao_pneu
          CHECK (perfil IN ('admin', 'operacional', 'motorista')),
        CONSTRAINT chk_status_gestao_pneu
          CHECK (status IN ('pendente', 'aprovado', 'recusado', 'bloqueado'))
      );

      CREATE INDEX IF NOT EXISTS idx_gestao_de_pneu_status
      ON gestao_de_pneu (status);

      CREATE INDEX IF NOT EXISTS idx_gestao_de_pneu_perfil
      ON gestao_de_pneu (perfil);

      CREATE INDEX IF NOT EXISTS idx_gestao_de_pneu_usuario_status
      ON gestao_de_pneu (usuario, status);

      ALTER TABLE gestao_de_pneu
      ADD COLUMN IF NOT EXISTS pode_cadastrar BOOLEAN NOT NULL DEFAULT TRUE;

      ALTER TABLE gestao_de_pneu
      ADD COLUMN IF NOT EXISTS pode_relatorios BOOLEAN NOT NULL DEFAULT TRUE;
    `);
  }

  return tableReadyPromise;
}

async function cadastrar(req, res) {
  try {
    await garantirTabelaUsuarios();

    const nome = String(req.body.nome || '').trim();
    const usuario = normalizarUsuario(req.body.usuario);
    const senha = String(req.body.senha || '');
    const perfilSolicitado = normalizarPerfil(req.body.perfil);
    const erros = validarCadastro({ nome, usuario, senha });

    if (erros.length) {
      return res.status(400).json({ error: erros.join(' ') });
    }

    const existente = await db.query(
      'SELECT id, status FROM gestao_de_pneu WHERE usuario = $1 LIMIT 1',
      [usuario]
    );

    if (existente.rows.length) {
      return res.status(409).json({ error: 'Esse usuario ja existe ou ja possui solicitacao.' });
    }

    const adminCount = await db.query(
      "SELECT COUNT(*)::int AS total FROM gestao_de_pneu WHERE perfil = 'admin' AND status = 'aprovado'"
    );

    const primeiroAdmin = Number(adminCount.rows[0]?.total || 0) === 0;
    const perfil = primeiroAdmin ? 'admin' : (perfilSolicitado === 'admin' ? 'operacional' : perfilSolicitado);
    const status = primeiroAdmin ? 'aprovado' : 'pendente';
    const senhaHash = hashPassword(senha);
    const podeCadastrar = primeiroAdmin || permissaoPadrao(perfil, 'cadastro');
    const podeRelatorios = primeiroAdmin || permissaoPadrao(perfil, 'relatorios');

    const insert = await db.query(`
      INSERT INTO gestao_de_pneu (
        nome, usuario, senha_hash, perfil, status, pode_cadastrar, pode_relatorios, aprovado_em, atualizado_em
      ) VALUES (
        $1, $2, $3, $4, $5::varchar, $6, $7,
        CASE WHEN $5::varchar = 'aprovado' THEN NOW() ELSE NULL END,
        NOW()
      )
      RETURNING id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
    `, [nome, usuario, senhaHash, perfil, status, podeCadastrar, podeRelatorios]);

    const usuarioCriado = usuarioPublico(insert.rows[0]);
    if (primeiroAdmin) {
      const token = signToken(usuarioCriado);
      return res.status(201).json({
        message: 'Primeiro administrador criado com sucesso.',
        status,
        usuario: usuarioCriado,
        token
      });
    }

    return res.status(201).json({
      message: 'Solicitacao enviada. Aguarde o administrador aprovar seu acesso.',
      status,
      usuario: usuarioCriado
    });
  } catch (error) {
    console.error('Erro ao cadastrar usuario:', error);
    return res.status(500).json({ error: 'Erro interno ao cadastrar usuario.' });
  }
}

async function login(req, res) {
  try {
    await garantirTabelaUsuarios();

    const usuario = normalizarUsuario(req.body.usuario);
    const senha = String(req.body.senha || '');

    if (!usuario || !senha) {
      return res.status(400).json({ error: 'Informe usuario e senha.' });
    }

    const result = await db.query(
      'SELECT * FROM gestao_de_pneu WHERE usuario = $1 LIMIT 1',
      [usuario]
    );

    const encontrado = result.rows[0];
    if (!encontrado || !verifyPassword(senha, encontrado.senha_hash)) {
      return res.status(401).json({ error: 'Usuario ou senha incorretos.' });
    }

    if (encontrado.status === 'pendente') {
      return res.status(403).json({ error: 'Seu acesso ainda esta aguardando aprovacao do administrador.' });
    }

    if (encontrado.status === 'bloqueado') {
      return res.status(403).json({ error: 'Seu acesso esta bloqueado. Fale com o administrador.' });
    }

    if (encontrado.status === 'recusado') {
      return res.status(403).json({ error: 'Sua solicitacao foi recusada. Fale com o administrador.' });
    }

    const update = await db.query(`
      UPDATE gestao_de_pneu
      SET ultimo_login = NOW(), atualizado_em = NOW()
      WHERE id = $1
      RETURNING id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
    `, [encontrado.id]);

    const usuarioLogado = usuarioPublico(update.rows[0]);
    return res.json({
      usuario: usuarioLogado,
      token: signToken(usuarioLogado)
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return res.status(500).json({ error: 'Erro interno ao fazer login.' });
  }
}

async function listarUsuarios(req, res) {
  try {
    await garantirTabelaUsuarios();

    if (!usuarioEhAdmin(req.usuario)) {
      const result = await db.query(`
        SELECT id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
        FROM gestao_de_pneu
        WHERE id = $1
        LIMIT 1
      `, [req.usuario.id]);
      return res.json(result.rows.map(usuarioPublico));
    }

    const statusQuery = String(req.query.status || '')
      .split(',')
      .map(normalizarStatus)
      .filter(Boolean);

    const params = [];
    let where = '';
    if (statusQuery.length) {
      params.push(statusQuery);
      where = 'WHERE status = ANY($1)';
    }

    const result = await db.query(`
      SELECT id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
      FROM gestao_de_pneu
      ${where}
      ORDER BY
        CASE status WHEN 'pendente' THEN 1 WHEN 'aprovado' THEN 2 WHEN 'bloqueado' THEN 3 ELSE 4 END,
        nome ASC
    `, params);

    return res.json(result.rows.map(usuarioPublico));
  } catch (error) {
    console.error('Erro ao listar usuarios:', error);
    return res.status(500).json({ error: 'Erro interno ao listar usuarios.' });
  }
}

async function atualizarMeuAcesso(req, res) {
  try {
    await garantirTabelaUsuarios();

    const id = Number(req.usuario.id);
    const nome = String(req.body.nome || '').trim();
    const usuario = normalizarUsuario(req.body.usuario);
    const senhaAtual = String(req.body.senhaAtual || '');
    const novaSenha = String(req.body.novaSenha || '');

    if (!id) return res.status(400).json({ error: 'Sessao invalida. Faca login novamente.' });
    if (!nome || !usuario) return res.status(400).json({ error: 'Informe nome e usuario.' });
    if (!/^[a-z0-9._-]{3,60}$/.test(usuario)) {
      return res.status(400).json({ error: 'Usuario deve ter 3 a 60 caracteres e usar apenas letras, numeros, ponto, traco ou underline.' });
    }
    if (novaSenha && novaSenha.length < 4) {
      return res.status(400).json({ error: 'Use uma nova senha com pelo menos 4 caracteres.' });
    }

    const atual = await db.query('SELECT * FROM gestao_de_pneu WHERE id = $1 LIMIT 1', [id]);
    const encontrado = atual.rows[0];
    if (!encontrado) return res.status(404).json({ error: 'Usuario nao encontrado.' });

    if (novaSenha && !verifyPassword(senhaAtual, encontrado.senha_hash)) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }

    const params = novaSenha
      ? [nome, usuario, hashPassword(novaSenha), id]
      : [nome, usuario, id];
    const sql = novaSenha
      ? `
        UPDATE gestao_de_pneu
        SET nome = $1, usuario = $2, senha_hash = $3, atualizado_em = NOW()
        WHERE id = $4
        RETURNING id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
      `
      : `
        UPDATE gestao_de_pneu
        SET nome = $1, usuario = $2, atualizado_em = NOW()
        WHERE id = $3
        RETURNING id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
      `;

    const update = await db.query(sql, params);
    const usuarioAtualizado = usuarioPublico(update.rows[0]);

    return res.json({
      usuario: usuarioAtualizado,
      token: signToken(usuarioAtualizado)
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Esse usuario ja existe.' });
    }
    console.error('Erro ao atualizar proprio acesso:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar seu acesso.' });
  }
}

async function atualizarStatusUsuario(req, res) {
  try {
    await garantirTabelaUsuarios();

    const id = Number(req.params.id);
    const status = normalizarStatus(req.body.status);

    if (!id) return res.status(400).json({ error: 'Usuario invalido.' });
    if (!['aprovado', 'recusado', 'bloqueado'].includes(status)) {
      return res.status(400).json({ error: 'Status invalido.' });
    }

    const atual = await db.query(
      'SELECT id, usuario, perfil, status FROM gestao_de_pneu WHERE id = $1 LIMIT 1',
      [id]
    );
    const alvo = atual.rows[0];
    if (!alvo) return res.status(404).json({ error: 'Usuario nao encontrado.' });

    if (Number(req.usuario.id) === Number(id) && status !== 'aprovado') {
      return res.status(400).json({ error: 'Voce nao pode bloquear ou recusar seu proprio acesso.' });
    }

    const update = await db.query(`
      UPDATE gestao_de_pneu
      SET
        status = $1::varchar,
        aprovado_por = CASE WHEN $1::varchar = 'aprovado' THEN $2 ELSE aprovado_por END,
        aprovado_em = CASE WHEN $1::varchar = 'aprovado' THEN NOW() ELSE aprovado_em END,
        recusado_em = CASE WHEN $1::varchar = 'recusado' THEN NOW() ELSE NULL END,
        atualizado_em = NOW()
      WHERE id = $3
      RETURNING id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
    `, [status, req.usuario.id, id]);

    return res.json(usuarioPublico(update.rows[0]));
  } catch (error) {
    console.error('Erro ao atualizar status do usuario:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar status do usuario.' });
  }
}

async function criarUsuarioDireto(req, res) {
  try {
    await garantirTabelaUsuarios();

    const nome = String(req.body.nome || '').trim();
    const usuario = normalizarUsuario(req.body.usuario);
    const senha = String(req.body.senha || '');
    const perfil = normalizarPerfil(req.body.perfil);
    const erros = validarCadastro({ nome, usuario, senha });

    if (erros.length) return res.status(400).json({ error: erros.join(' ') });

    const insert = await db.query(`
      INSERT INTO gestao_de_pneu (
        nome, usuario, senha_hash, perfil, status, pode_cadastrar, pode_relatorios, aprovado_por, aprovado_em, atualizado_em
      ) VALUES ($1, $2, $3, $4, 'aprovado', $5, $6, $7, NOW(), NOW())
      RETURNING id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
    `, [nome, usuario, hashPassword(senha), perfil, permissaoPadrao(perfil, 'cadastro'), permissaoPadrao(perfil, 'relatorios'), req.usuario.id]);

    return res.status(201).json(usuarioPublico(insert.rows[0]));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Esse usuario ja existe.' });
    }
    console.error('Erro ao criar usuario:', error);
    return res.status(500).json({ error: 'Erro interno ao criar usuario.' });
  }
}

async function atualizarUsuario(req, res) {
  try {
    await garantirTabelaUsuarios();

    const id = Number(req.params.id);
    const nome = String(req.body.nome || '').trim();
    const usuario = normalizarUsuario(req.body.usuario);
    const perfil = normalizarPerfil(req.body.perfil);
    const status = req.body.ativo === false ? 'bloqueado' : normalizarStatus(req.body.status || 'aprovado');

    if (!id || !nome || !usuario) return res.status(400).json({ error: 'Informe nome e usuario.' });
    if (Number(req.usuario.id) === Number(id) && status !== 'aprovado') {
      return res.status(400).json({ error: 'Voce nao pode bloquear seu proprio acesso.' });
    }

    const update = await db.query(`
      UPDATE gestao_de_pneu
      SET nome = $1, usuario = $2, perfil = $3, status = $4, atualizado_em = NOW()
      WHERE id = $5
      RETURNING id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
    `, [nome, usuario, perfil, status, id]);

    if (!update.rows.length) return res.status(404).json({ error: 'Usuario nao encontrado.' });
    return res.json(usuarioPublico(update.rows[0]));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Esse usuario ja existe.' });
    }
    console.error('Erro ao atualizar usuario:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar usuario.' });
  }
}

async function alterarSenha(req, res) {
  try {
    await garantirTabelaUsuarios();

    const id = Number(req.params.id);
    const senha = String(req.body.senha || '');
    if (!id || senha.length < 4) return res.status(400).json({ error: 'Informe uma senha com pelo menos 4 caracteres.' });

    const update = await db.query(`
      UPDATE gestao_de_pneu
      SET senha_hash = $1, atualizado_em = NOW()
      WHERE id = $2
      RETURNING id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
    `, [hashPassword(senha), id]);

    if (!update.rows.length) return res.status(404).json({ error: 'Usuario nao encontrado.' });
    return res.json(usuarioPublico(update.rows[0]));
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    return res.status(500).json({ error: 'Erro interno ao alterar senha.' });
  }
}

async function atualizarPermissoes(req, res) {
  try {
    await garantirTabelaUsuarios();

    const id = Number(req.params.id);
    const podeCadastrar = Boolean(req.body.podeCadastrar);
    const podeRelatorios = Boolean(req.body.podeRelatorios);

    if (!id) return res.status(400).json({ error: 'Usuario invalido.' });

    const update = await db.query(`
      UPDATE gestao_de_pneu
      SET pode_cadastrar = $1, pode_relatorios = $2, atualizado_em = NOW()
      WHERE id = $3
      RETURNING id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios, criado_em, atualizado_em, aprovado_em, aprovado_por, recusado_em, ultimo_login
    `, [podeCadastrar, podeRelatorios, id]);

    if (!update.rows.length) return res.status(404).json({ error: 'Usuario nao encontrado.' });
    return res.json(usuarioPublico(update.rows[0]));
  } catch (error) {
    console.error('Erro ao atualizar permissoes:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar permissoes.' });
  }
}

async function excluirUsuario(req, res) {
  try {
    await garantirTabelaUsuarios();

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Usuario invalido.' });
    if (Number(req.usuario.id) === Number(id)) {
      return res.status(400).json({ error: 'Voce nao pode excluir seu proprio acesso.' });
    }

    const deleted = await db.query('DELETE FROM gestao_de_pneu WHERE id = $1 RETURNING id', [id]);
    if (!deleted.rows.length) return res.status(404).json({ error: 'Usuario nao encontrado.' });
    return res.json({ message: 'Usuario excluido com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir usuario:', error);
    return res.status(500).json({ error: 'Erro interno ao excluir usuario.' });
  }
}

module.exports = {
  garantirTabelaUsuarios,
  cadastrar,
  login,
  listarUsuarios,
  atualizarMeuAcesso,
  atualizarStatusUsuario,
  criarUsuarioDireto,
  atualizarUsuario,
  atualizarPermissoes,
  alterarSenha,
  excluirUsuario
};
