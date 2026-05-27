/* ============================================
   EXECUTIVA AGRONEGÓCIOS - APP v3.0
   Sistema de Gestão de Pneus e Frota
============================================ */

const $ = id => document.getElementById(id);
const KEYS = {
  PNEUS: 'pneus',
  MOVS: 'movimentacoes',
  VEICULOS: 'veiculos',
  MOTORISTAS: 'motoristas',
  CONFERENCIAS: 'conferencias_pneus',
  RECAPAGENS: 'recapagens_custos',
  USER: 'usuarioLogado',
  USERS: 'usuariosSistema',
  ACCESS_REQUESTS: 'solicitacoesAcessoSistema'
};
const API_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:3000/api'
  : 'https://executiva-backend.onrender.com/api';
const MAX_TABLE_ROWS = 300;

function obterTokenSessao() {
  try {
    const usuario = JSON.parse(sessionStorage.getItem(KEYS.USER) || 'null');
    return usuario?.token || sessionStorage.getItem('authToken') || '';
  } catch {
    return sessionStorage.getItem('authToken') || '';
  }
}

function authHeaders(headers = {}) {
  const token = obterTokenSessao();
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function asNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dataIsoCurta(v) {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

function normalizarPneu(p) {
  const numPneu = String(p.numPneu || p.NPneu || p.id || '').trim();
  const marca = String(p.marca || p.Marca || '').trim();
  return {
    ...p,
    id: String(p.id || p.codSistema || numPneu),
    codSistema: String(p.codSistema || p.id || numPneu),
    numPneu,
    marcaCodigo: String(p.marcaCodigo || p.MarcaCodigo || (/^\d+$/.test(marca) ? marca : '')).trim(),
    marca: marca || 'Marca nao informada',
    modelo: String(p.modelo || p.Modelo || ''),
    medida: String(p.medida || p.Largura || ''),
    tipo: String(p.tipo || p.TipoPneu || ''),
    dataCompra: dataIsoCurta(p.dataCompra),
    valorCompra: asNumber(p.valorCompra),
    kmCompra: asNumber(p.kmCompra),
    fornecedorCompra: String(p.fornecedorCompra || p.FornecedorCompra || ''),
    notaFiscalCompra: String(p.notaFiscalCompra || p.NotaFiscalCompra || ''),
    observacaoCompra: String(p.observacaoCompra || p.ObsCompra || ''),
    profundidadeAtual: asNumber(p.profundidadeAtual),
    profundidadeInicial: asNumber(p.profundidadeInicial || p.profundidadeAtual),
    kmRodadoTotal: asNumber(p.kmRodadoTotal),
    custoRecapagens: asNumber(p.custoRecapagens),
    quantidadeRecapagens: asNumber(p.quantidadeRecapagens || p.quantidade_recapagens),
    statusAtual: p.statusAtual || 'Estoque',
    veiculoAtual: p.veiculoAtual || 'Estoque',
    localAtual: p.localAtual || 'Estoque',
    recapagens: Array.isArray(p.recapagens) ? p.recapagens : []
  };
}

function normalizarMovimentacao(m) {
  const tipoMov = m.tipo_movimentacao || m.tipoMov || '';
  const dataMov = dataIsoCurta(m.data_movimentacao || m.dataMov);
  const numeroPneu = String(m.numeroPneu || m.id_pneu || '').trim();
  return {
    ...m,
    id: String(m.id || gerarId()),
    data_movimentacao: dataMov,
    dataMov,
    numeroPneu,
    id_pneu: numeroPneu,
    tipo_movimentacao: tipoMov,
    tipoMov,
    veiculoAnterior: m.veiculoAnterior || 'Estoque',
    localAnterior: m.localAnterior || 'Estoque',
    placa_veiculo: m.placa_veiculo || m.veiculoAtual || '',
    veiculoAtual: m.veiculoAtual || m.placa_veiculo || '',
    posicao: m.posicao || m.localAtual || '',
    localAtual: m.localAtual || m.posicao || '',
    km_entrada: asNumber(m.km_entrada),
    km_saida: asNumber(m.km_saida),
    profundidade: asNumber(m.profundidade),
    valorRecape: asNumber(m.valorRecape),
    fornecedorRecape: m.fornecedorRecape || '',
    tipoServicoRecape: m.tipoServicoRecape || '',
    observacao: m.observacao || ''
  };
}

function normalizarVeiculo(v) {
  return {
    ...v,
    id: String(v.id || v.placa || gerarId()),
    placa: String(v.placa || '').trim(),
    marca: String(v.marca || ''),
    modelo: String(v.modelo || ''),
    tipo: String(v.tipo || 'Cavalo'),
    ano: v.ano || '',
    motorista: v.motorista || ''
  };
}

function normalizarMotorista(m) {
  return {
    ...m,
    nome: m.nome || '',
    cpf: m.cpf || '',
    cnh: m.cnh || '',
    celular: m.celular || '',
    tipoCNH: m.tipoCNH || '',
    validadeCNH: dataIsoCurta(m.validadeCNH),
    observacao: m.observacao || ''
  };
}

function normalizarDados(resource, dados) {
  if (!Array.isArray(dados)) return [];
  if (resource === 'pneus') return dados.map(normalizarPneu).filter(p => p.numPneu);
  if (resource === 'movimentacoes') return dados.map(normalizarMovimentacao);
  if (resource === 'veiculos') return dados.map(normalizarVeiculo).filter(v => v.placa);
  if (resource === 'motoristas') return dados.map(normalizarMotorista).filter(m => m.nome || m.cpf);
  return dados;
}

async function fetchApiData(resource) {
  try {
    const res = await fetch(`${API_URL}/${resource}`);
    if (!res.ok) throw new Error(`Erro ao buscar ${resource}`);
    return await res.json();
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function sincronizarDadosBanco(resources = null) {
  const todasFontes = [
    { resource: 'pneus', key: KEYS.PNEUS },
    { resource: 'movimentacoes', key: KEYS.MOVS },
    { resource: 'veiculos', key: KEYS.VEICULOS },
    { resource: 'motoristas', key: KEYS.MOTORISTAS }
  ];
  const fontes = resources ? todasFontes.filter(fonte => resources.includes(fonte.resource)) : todasFontes;

  const resultados = await Promise.all(fontes.map(async fonte => ({
    key: fonte.key,
    resource: fonte.resource,
    dados: await fetchApiData(fonte.resource)
  })));

  resultados.forEach(({ key, resource, dados }) => {
    if (Array.isArray(dados)) saveData(key, normalizarDados(resource, dados));
  });
}

async function fetchMotoristas() {
  try {
    const res = await fetch(`${API_URL}/motoristas`);
    if (!res.ok) throw new Error('Erro ao buscar motoristas');
    return await res.json();
  } catch (e) {
    console.error(e);
    return getData(KEYS.MOTORISTAS);
  }
}

async function apiSalvarMotorista(motorista) {
  const res = await fetch(`${API_URL}/motoristas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(motorista)
  });
  if (!res.ok) throw new Error('Erro ao salvar motorista');
  return await res.json();
}

async function apiAtualizarMotorista(cpf, motorista) {
  const res = await fetch(`${API_URL}/motoristas/${cpf}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(motorista)
  });
  if (!res.ok) throw new Error('Erro ao atualizar motorista');
  return await res.json();
}

async function apiExcluirMotorista(cpf) {
  const res = await fetch(`${API_URL}/motoristas/${cpf}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Erro ao excluir motorista');
  return true;
}

async function apiSalvarPneu(pneu) {
  const res = await fetch(`${API_URL}/pneus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pneu)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao salvar pneu no banco');
  return data;
}

async function apiSalvarMovimentacao(movimentacao) {
  const res = await fetch(`${API_URL}/movimentacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(movimentacao)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao salvar movimentacao no banco');
  return data;
}

async function apiAtualizarMovimentacao(id, movimentacao) {
  const res = await fetch(`${API_URL}/movimentacoes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(movimentacao)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao atualizar movimentacao no banco');
  return data;
}

async function fetchConferencias(status = '') {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_URL}/conferencias${query}`, {
    headers: authHeaders()
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data.error || 'Erro ao buscar conferencias');
  if (Array.isArray(data)) saveData(KEYS.CONFERENCIAS, data);
  return Array.isArray(data) ? data : [];
}

async function apiCriarConferencia(conferencia) {
  const res = await fetch(`${API_URL}/conferencias`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(conferencia)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao enviar conferencia');
  return data;
}

async function apiAtualizarStatusConferencia(id, status, motivo = '') {
  const res = await fetch(`${API_URL}/conferencias/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status, motivo })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao atualizar conferencia');
  return data;
}

/* === STORAGE === */
function getData(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } }
function saveData(k, d) { localStorage.setItem(k, JSON.stringify(d)); }
function getVal(id) { const e = $(id); return e ? e.value.trim() : ''; }
function setVal(id, v = '') { const e = $(id); if (e) e.value = v; }
function gerarId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }
function moeda(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function kmFormatado(v) { return (Number(v) || 0) > 0 ? `${Number(v).toLocaleString('pt-BR')}\u00a0km` : '-'; }
function cpkFormatado(v) {
  const n = Number(v) || 0;
  const casas = n < 0.01 ? 4 : 3;
  return `R$\u00a0${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: 4 })}/km`;
}

function notificar(mensagem, tipo = 'info') {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
  }

  const labels = {
    success: 'Sucesso',
    error: 'Atenção',
    warning: 'Atenção',
    info: 'Sistema'
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<strong>${labels[tipo] || labels.info}</strong><span>${escapeHtml(mensagem)}</span>`;
  host.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 220);
  }, tipo === 'error' ? 6200 : 4200);
}

function setBotaoCarregando(botao, carregando, texto = 'Salvando...') {
  if (!botao) return true;
  if (carregando) {
    if (botao.dataset.loading === '1') return false;
    botao.dataset.loading = '1';
    botao.dataset.originalText = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = texto;
    return true;
  }

  botao.disabled = false;
  botao.innerHTML = botao.dataset.originalText || botao.innerHTML;
  delete botao.dataset.loading;
  delete botao.dataset.originalText;
  return true;
}

function normalizarChave(valor) {
  return String(valor || '').trim().toUpperCase();
}

function validarNumeroFaixa(valor, minimo, maximo, nomeCampo, obrigatorio = false) {
  const bruto = String(valor ?? '').trim();
  if (!bruto && !obrigatorio) return null;
  const numero = Number(bruto);
  if (!Number.isFinite(numero)) return `${nomeCampo} precisa ser um número válido.`;
  if (numero < minimo || numero > maximo) return `${nomeCampo} deve ficar entre ${minimo} e ${maximo}.`;
  return null;
}

function validarCadastroPneu(pneu, pneus) {
  const erros = [];
  if (!pneu.numPneu) erros.push('Informe o Nº de Fogo do pneu.');
  if (!pneu.marca) erros.push('Informe a marca do pneu.');
  if (!pneu.modelo) erros.push('Informe o modelo do pneu.');
  if (!pneu.dataCompra) erros.push('Informe a data da compra.');

  const chave = normalizarChave(pneu.numPneu);
  if (chave && pneus.some(p => normalizarChave(p.numPneu) === chave)) {
    erros.push('Este Nº de Fogo já está cadastrado.');
  }

  if (pneu.dataCompra && new Date(`${pneu.dataCompra}T00:00:00`) > new Date()) {
    erros.push('A data da compra não pode ser futura.');
  }

  [
    validarNumeroFaixa(getVal('valorCompra'), 0, 1000000, 'Valor de compra'),
    validarNumeroFaixa(getVal('kmCompra'), 0, 5000000, 'KM na compra')
  ].filter(Boolean).forEach(erro => erros.push(erro));

  return erros;
}

function validarMovimentacaoFormulario(mov, pneu, editando = false) {
  const erros = [];
  const tipo = mov.tipo_movimentacao || mov.tipoMov || '';
  const kmVeiculo = asNumber(getVal('kmVeiculo'));
  const profundidadeRaw = getVal('profundidade');

  if (!mov.data_movimentacao) erros.push('Informe a data da movimentação.');
  if (!mov.numeroPneu) erros.push('Informe o Nº de Fogo do pneu.');
  if (!tipo) erros.push('Selecione o tipo da movimentação.');
  if (!pneu) erros.push('Pneu não encontrado. Verifique o Nº de Fogo.');

  if (mov.data_movimentacao && new Date(`${mov.data_movimentacao}T00:00:00`) > new Date()) {
    erros.push('A data da movimentação não pode ser futura.');
  }

  const erroProf = document.getElementById('profundidade')
    ? validarNumeroFaixa(profundidadeRaw, 0, 40, 'Profundidade')
    : null;
  if (erroProf) erros.push(erroProf);

  if (pneu && pneu.statusAtual === 'Baixado' && !editando) {
    erros.push('Este pneu está baixado e não deve receber nova movimentação.');
  }

  if (tipo === 'Instalacao') {
    if (pneu && pneu.statusAtual === 'Rodando' && !editando) erros.push('Este pneu já está rodando. Faça a retirada antes de instalar em outro local.');
    if (!mov.veiculoAtual) erros.push('Selecione o veículo de destino.');
    if (!mov.localAtual) erros.push('Informe eixo e lado para gerar o local atual.');
    if (kmVeiculo <= 0) erros.push('Informe o KM do veículo para instalação.');
  }

  if (tipo === 'Atualizacao') {
    if (!mov.veiculoAtual) erros.push('Selecione o veículo para atualização.');
    if (!mov.localAtual) erros.push('Informe eixo e lado para gerar o local atual.');
    if (kmVeiculo <= 0) erros.push('Informe o KM do veículo para atualização.');
  }

  if (tipo === 'Retirada') {
    if (pneu && pneu.statusAtual === 'Estoque') erros.push('Este pneu já está em estoque.');
    if (kmVeiculo <= 0) erros.push('Informe o KM do veículo na retirada.');
  }

  if (tipo === 'Baixa' && kmVeiculo <= 0) {
    erros.push('Informe o KM final para baixar o pneu.');
  }

  if (tipo === 'Recapagem') {
    const valorRecape = asNumber(getVal('valorRecape'));
    if (!getVal('fornecedorRecape')) erros.push('Informe o fornecedor da recapagem/conserto.');
    if (valorRecape <= 0) erros.push('Informe o valor da recapagem/conserto.');
  }

  if ((tipo === 'Instalacao' || tipo === 'Atualizacao') && mov.veiculoAtual && mov.localAtual) {
    const pneus = getData(KEYS.PNEUS);
    const ocupado = pneus.find(p =>
      normalizarChave(p.numPneu) !== normalizarChave(mov.numeroPneu) &&
      p.statusAtual === 'Rodando' &&
      normalizarChave(p.veiculoAtual) === normalizarChave(mov.veiculoAtual) &&
      normalizarChave(p.localAtual) === normalizarChave(mov.localAtual)
    );
    if (ocupado) {
      erros.push(`A posição ${mov.localAtual} do veículo ${mov.veiculoAtual} já está ocupada pelo pneu ${ocupado.numPneu}.`);
    }
  }

  return erros;
}

function custoTotalPneu(p) {
  const recaps = asNumber(p.custoRecapagens) || (Array.isArray(p.recapagens) ? p.recapagens.reduce((a, r) => a + asNumber(r.valor), 0) : 0);
  return asNumber(p.valorCompra) + recaps;
}
function cpkPneu(p) {
  const km = asNumber(p.kmRodadoTotal);
  const custo = custoTotalPneu(p);
  return km > 0 && custo > 0 ? custo / km : null;
}

function quantidadeRecapagensPneu(p) {
  return asNumber(p.quantidadeRecapagens || p.quantidade_recapagens) ||
    (Array.isArray(p.recapagens) ? p.recapagens.length : 0);
}

function statusBadgeClass(status) {
  return status === 'Rodando' ? 'badge-success' :
    status === 'Estoque' ? 'badge-warning' :
      status === 'Baixado' ? 'badge-danger' :
        status === 'Recapado' ? 'badge-purple' : 'badge-info';
}

function diagnosticoPneu(p, contexto = {}) {
  const km = asNumber(p.kmRodadoTotal);
  const cpk = cpkPneu(p);
  const recapagens = quantidadeRecapagensPneu(p);
  const kmMedio = asNumber(contexto.kmMedio);
  const cpkMedio = asNumber(contexto.cpkMedio);

  if (p.statusAtual === 'Baixado') return { texto: 'Baixado', classe: 'badge-danger' };
  if (cpk !== null && cpkMedio > 0 && cpk > cpkMedio * 1.25) return { texto: 'CPK alto', classe: 'badge-danger' };
  if (kmMedio > 0 && km > kmMedio * 1.35) return { texto: 'KM alto', classe: 'badge-warning' };
  if (km <= 0 && p.statusAtual !== 'Estoque') return { texto: 'Sem KM', classe: 'badge-info' };
  if (recapagens > 0) return { texto: 'Recapado', classe: 'badge-purple' };
  return { texto: 'OK', classe: 'badge-success' };
}

/* === AUTH === */
function obterUsuarioLogado() {
  localStorage.removeItem(KEYS.USER);
  const raw = sessionStorage.getItem(KEYS.USER);
  if (!raw) return null;

  try {
    const usuario = JSON.parse(raw);
    if (usuario && usuario.usuario) return usuario;
  } catch {
    return { nome: raw, usuario: raw };
  }

  return null;
}

function salvarSessaoUsuario(usuario, token = null) {
  const atual = obterUsuarioLogado() || {};
  const novaSessao = {
    ...atual,
    ...usuario,
    token: token || usuario?.token || atual.token
  };
  sessionStorage.setItem(KEYS.USER, JSON.stringify(novaSessao));
  if (novaSessao.token) sessionStorage.setItem('authToken', novaSessao.token);
  return novaSessao;
}

function exigirLogin() {
  const usuario = obterUsuarioLogado();
  if (!usuario) {
    window.location.href = 'login.html';
    return null;
  }

  return usuario;
}

function atualizarUsuarioNaInterface(usuario) {
  if (!usuario) return;
  prepararMenuAdministrativo(usuario);
  document.querySelectorAll('.sidebar-footer').forEach(footer => {
    let info = footer.querySelector('.sidebar-user');
    if (!info) {
      info = document.createElement('div');
      info.className = 'sidebar-user';
      footer.prepend(info);
    }
    info.className = 'sidebar-user';
    const perfil = perfilLabelSistema(usuario.perfil);
    info.innerHTML = `<span>${perfil}</span><strong>${usuario.nome || usuario.usuario}</strong>`;
  });
}

function fazerLogout() {
  sessionStorage.removeItem(KEYS.USER);
  sessionStorage.removeItem('authToken');
  localStorage.removeItem(KEYS.USER);
  window.location.href = 'login.html';
}

function paginaAtualEhMotorista() {
  return document.body.id === 'motorista-app-page';
}

function usuarioEhAdmin(usuario) {
  return perfilUsuarioNormalizado(usuario?.perfil) === 'admin';
}

function perfilUsuarioNormalizado(perfil) {
  const normalizado = String(perfil || '').trim().toLowerCase();
  if (['admin', 'administrador', 'adm'].includes(normalizado)) return 'admin';
  if (normalizado === 'operacional') return 'assistente';
  if (normalizado === 'motorista') return 'motorista';
  return 'assistente';
}

function usuarioPodeCadastrar(usuario) {
  if (usuarioEhAdmin(usuario)) return true;
  return usuario?.podeCadastrar !== false;
}

function usuarioPodeRelatorios(usuario) {
  if (usuarioEhAdmin(usuario)) return true;
  return usuario?.podeRelatorios !== false;
}

function exigirPerfil(usuario) {
  if (!usuario) return false;
  const perfil = perfilUsuarioNormalizado(usuario.perfil || 'admin');
  if (document.body.id === 'configuracoes-page') return true;
  if (paginaAtualEhMotorista()) return true;
  if (perfil === 'motorista') {
    window.location.href = 'motorista-app.html';
    return false;
  }

  if (document.body.id === 'relatorios-page' && !usuarioPodeRelatorios(usuario)) {
    notificar('Seu acesso nao permite consultar relatorios.', 'error');
    window.location.href = 'dashboard.html';
    return false;
  }

  if (['motoristas-page', 'veiculos-page', 'pneus-page'].includes(document.body.id) && !usuarioPodeCadastrar(usuario)) {
    notificar('Seu acesso nao permite fazer cadastros.', 'error');
    window.location.href = 'dashboard.html';
    return false;
  }

  return true;
}

function prepararMenuAdministrativo(usuario) {
  const nav = document.querySelector('.sidebar-nav');
  if (!nav) return;

  let linkConfig = nav.querySelector('[data-admin-settings]');
  if (!linkConfig) {
    linkConfig = document.createElement('a');
    linkConfig.href = 'configuracoes.html';
    linkConfig.dataset.adminSettings = '1';
    linkConfig.innerHTML = '<span class="nav-icon">⚙️</span><span class="nav-text">Configurações</span>';
    nav.appendChild(linkConfig);
  }

  linkConfig.style.display = '';
  linkConfig.classList.toggle('active', document.body.id === 'configuracoes-page');

  ['motoristas.html', 'veiculos.html', 'pneus.html'].forEach(href => {
    const link = nav.querySelector(`a[href="${href}"]`);
    if (link) link.style.display = usuarioPodeCadastrar(usuario) ? '' : 'none';
  });

  const linkRelatorios = nav.querySelector('a[href="relatorios.html"]');
  if (linkRelatorios) linkRelatorios.style.display = usuarioPodeRelatorios(usuario) ? '' : 'none';
}

/* === USUARIOS DO SISTEMA === */
let usuarioSistemaEmEdicao = null;

async function apiUsuarios(path = '', options = {}) {
  const headers = authHeaders(options.headers || {});
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}/usuarios${path}`, {
    ...options,
    headers
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao processar usuarios.');
  return data;
}

async function listarUsuariosSistema() {
  return await apiUsuarios();
}

async function salvarUsuarioSistemaApi(usuario) {
  return await apiUsuarios(usuario.id ? `/${usuario.id}` : '', {
    method: usuario.id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(usuario)
  });
}

async function alterarSenhaUsuarioSistema(id, senha) {
  return await apiUsuarios(`/${id}/senha`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha })
  });
}

async function excluirUsuarioSistemaApi(id) {
  return await apiUsuarios(`/${id}`, { method: 'DELETE' });
}

function initUsuariosSistema() {
  if ($('btnSalvarUsuario')) $('btnSalvarUsuario').addEventListener('click', salvarUsuarioSistema);
  if ($('btnCancelarUsuario')) $('btnCancelarUsuario').addEventListener('click', limparFormularioUsuarioSistema);
  if ($('buscaUsuarioSistema')) $('buscaUsuarioSistema').addEventListener('input', renderUsuariosSistema);
  renderUsuariosSistema();
}

async function salvarUsuarioSistema() {
  const nome = getVal('usuarioNome');
  const usuario = getVal('usuarioLogin').toLowerCase();
  const perfil = perfilUsuarioNormalizado(getVal('usuarioPerfil') || 'motorista');
  const ativo = getVal('usuarioAtivo') !== 'false';
  const senha = getVal('usuarioSenha');

  if (!nome || !usuario) {
    alert('Preencha nome e usuario.');
    return;
  }
  if (!usuarioSistemaEmEdicao && !senha) {
    alert('Informe uma senha para criar o usuario.');
    return;
  }

  try {
    const payload = { id: usuarioSistemaEmEdicao, nome, usuario, perfil, ativo };
    await salvarUsuarioSistemaApi(payload);
    if (usuarioSistemaEmEdicao && senha) await alterarSenhaUsuarioSistema(usuarioSistemaEmEdicao, senha);
    alert(usuarioSistemaEmEdicao ? 'Usuario atualizado!' : 'Usuario criado!');
    limparFormularioUsuarioSistema();
    renderUsuariosSistema();
  } catch (error) {
    alert(error.message);
  }
}

function limparFormularioUsuarioSistema() {
  usuarioSistemaEmEdicao = null;
  ['usuarioNome', 'usuarioLogin', 'usuarioSenha'].forEach(id => setVal(id));
  setVal('usuarioPerfil', 'assistente');
  setVal('usuarioAtivo', 'true');
  if ($('tituloFormUsuario')) $('tituloFormUsuario').textContent = 'Novo usuario';
  if ($('btnSalvarUsuario')) $('btnSalvarUsuario').textContent = 'Salvar usuario';
  if ($('btnCancelarUsuario')) $('btnCancelarUsuario').style.display = 'none';
}

async function renderUsuariosSistema() {
  const tbody = $('corpoTabelaUsuarios');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando usuarios...</td></tr>';
  try {
    const busca = (getVal('buscaUsuarioSistema') || '').toLowerCase();
    const usuarios = await listarUsuariosSistema();
    const filtrados = usuarios.filter(u => !busca ||
      (u.nome || '').toLowerCase().includes(busca) ||
      (u.usuario || '').toLowerCase().includes(busca) ||
      (u.perfil || '').toLowerCase().includes(busca)
    );

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum usuario encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    filtrados.forEach(u => {
      const perfilLabel = perfilLabelSistema(u.perfil);
      const statusClass = u.ativo ? 'badge-success' : 'badge-danger';
      const statusLabel = u.ativo ? 'Ativo' : 'Bloqueado';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${u.nome || '-'}</strong></td>
        <td>${u.usuario || '-'}</td>
        <td><span class="badge badge-info">${perfilLabel}</span></td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td>
          <button class="btn-icon" onclick="editarUsuarioSistema(${u.id})" title="Editar">E</button>
          <button class="btn-icon" onclick="excluirUsuarioSistema(${u.id})" title="Excluir">X</button>
        </td>`;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">${error.message}</td></tr>`;
  }
}

async function editarUsuarioSistema(id) {
  try {
    const usuarios = await listarUsuariosSistema();
    const usuario = usuarios.find(u => Number(u.id) === Number(id));
    if (!usuario) return;
    usuarioSistemaEmEdicao = usuario.id;
    setVal('usuarioNome', usuario.nome || '');
    setVal('usuarioLogin', usuario.usuario || '');
    setVal('usuarioPerfil', perfilUsuarioNormalizado(usuario.perfil || 'motorista'));
    setVal('usuarioAtivo', usuario.ativo ? 'true' : 'false');
    setVal('usuarioSenha', '');
    if ($('tituloFormUsuario')) $('tituloFormUsuario').textContent = 'Editar usuario';
    if ($('btnSalvarUsuario')) $('btnSalvarUsuario').textContent = 'Atualizar usuario';
    if ($('btnCancelarUsuario')) $('btnCancelarUsuario').style.display = 'inline-flex';
  } catch (error) {
    alert(error.message);
  }
}

async function excluirUsuarioSistema(id) {
  if (!confirm('Excluir este usuario?')) return;
  try {
    await excluirUsuarioSistemaApi(id);
    renderUsuariosSistema();
  } catch (error) {
    alert(error.message);
  }
}

/* === VEÍCULOS === */
let veiculoEmEdicao = null;

function initVeiculos() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.getAttribute('data-target');
      if ($(t)) $(t).classList.add('active');
    });
  });
  if ($('btnSalvarVeiculo')) $('btnSalvarVeiculo').addEventListener('click', salvarVeiculo);
  if ($('btnCancelarEdicaoVeiculo')) $('btnCancelarEdicaoVeiculo').addEventListener('click', limparFormularioVeiculo);
  if ($('buscaVeiculo')) $('buscaVeiculo').addEventListener('input', renderVeiculos);
  if ($('btnEditarVeiculoDiagrama')) $('btnEditarVeiculoDiagrama').addEventListener('click', () => editarVeiculo($('btnEditarVeiculoDiagrama').dataset.id));

  const inputMotorista = $('veiculoMotorista');
  const listaMotoristas = $('listaMotoristas');
  if (inputMotorista && listaMotoristas) {
    fetchMotoristas().then(motoristas => {
      const nomes = [...new Set(motoristas
        .map(m => String(m.nome || '').trim())
        .filter(nome => nome && nome !== '0'))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
      listaMotoristas.innerHTML = '';
      nomes.forEach(nome => {
        const opt = document.createElement('option');
        opt.value = nome;
        listaMotoristas.appendChild(opt);
      });
    }).catch(e => console.error('Erro ao popular motoristas:', e));
  }

  renderVeiculos();
}

function salvarVeiculo() {
  const placa = getVal('veiculoPlaca').toUpperCase(), marca = getVal('veiculoMarca'),
    modelo = getVal('veiculoModelo'), tipo = getVal('veiculoTipo'),
    ano = getVal('veiculoAno'), motorista = getVal('veiculoMotorista');
  if (!placa || !marca || !modelo || !tipo) { alert('Preencha Placa, Marca, Modelo e Tipo.'); return; }
  const veiculos = getData(KEYS.VEICULOS);
  if (veiculoEmEdicao) {
    const idx = veiculos.findIndex(v => v.id === veiculoEmEdicao);
    if (idx < 0) { alert('Veículo não encontrado para edição.'); limparFormularioVeiculo(); return; }
    if (veiculos.some(v => v.id !== veiculoEmEdicao && (v.placa || '').toUpperCase() === placa)) {
      alert('Veículo com esta placa já existe!');
      return;
    }
    const placaAnterior = veiculos[idx].placa;
    veiculos[idx] = { ...veiculos[idx], placa, marca, modelo, tipo, ano, motorista, dataAtualizacao: new Date().toLocaleDateString('pt-BR') };
    if (placaAnterior && placaAnterior !== placa) atualizarPlacaRelacionada(placaAnterior, placa);
    saveData(KEYS.VEICULOS, veiculos);
    alert('Veículo atualizado com sucesso!');
  } else {
    if (veiculos.some(v => (v.placa || '').toUpperCase() === placa)) { alert('Veículo com esta placa já existe!'); return; }
    veiculos.push({ id: gerarId(), placa, marca, modelo, tipo, ano, motorista, dataCadastro: new Date().toLocaleDateString('pt-BR') });
    saveData(KEYS.VEICULOS, veiculos);
    alert('Veículo cadastrado com sucesso!');
  }
  limparFormularioVeiculo();
  renderVeiculos();
  document.querySelector('.tab-btn[data-target="tab-lista"]')?.click();
}

function atualizarPlacaRelacionada(placaAnterior, placaNova) {
  const pneus = getData(KEYS.PNEUS).map(p => p.veiculoAtual === placaAnterior ? { ...p, veiculoAtual: placaNova } : p);
  const movs = getData(KEYS.MOVS).map(m => ({
    ...m,
    veiculoAtual: m.veiculoAtual === placaAnterior ? placaNova : m.veiculoAtual,
    placa_veiculo: m.placa_veiculo === placaAnterior ? placaNova : m.placa_veiculo,
    veiculoAnterior: m.veiculoAnterior === placaAnterior ? placaNova : m.veiculoAnterior
  }));
  saveData(KEYS.PNEUS, pneus);
  saveData(KEYS.MOVS, movs);
}

function limparFormularioVeiculo() {
  veiculoEmEdicao = null;
  ['veiculoPlaca', 'veiculoMarca', 'veiculoModelo', 'veiculoTipo', 'veiculoAno', 'veiculoMotorista'].forEach(id => setVal(id));
  if ($('btnSalvarVeiculo')) $('btnSalvarVeiculo').textContent = '💾 Salvar Veículo';
  if ($('btnCancelarEdicaoVeiculo')) $('btnCancelarEdicaoVeiculo').style.display = 'none';
}

function editarVeiculo(id) {
  const veiculo = getData(KEYS.VEICULOS).find(v => v.id === id);
  if (!veiculo) return;
  veiculoEmEdicao = id;
  setVal('veiculoPlaca', veiculo.placa || '');
  setVal('veiculoMarca', veiculo.marca || '');
  setVal('veiculoModelo', veiculo.modelo || '');
  setVal('veiculoTipo', veiculo.tipo || '');
  setVal('veiculoAno', veiculo.ano || '');
  setVal('veiculoMotorista', veiculo.motorista || '');
  if ($('btnSalvarVeiculo')) $('btnSalvarVeiculo').textContent = '💾 Atualizar Veículo';
  if ($('btnCancelarEdicaoVeiculo')) $('btnCancelarEdicaoVeiculo').style.display = 'inline-flex';
  document.querySelector('.tab-btn[data-target="tab-cadastro"]')?.click();
}

function renderVeiculos() {
  const tbody = $('corpoTabelaVeiculos'); if (!tbody) return;
  const veiculos = getData(KEYS.VEICULOS);
  const busca = (getVal('buscaVeiculo') || '').toLowerCase();
  const filtrados = veiculos.filter(v => !busca || (v.placa || '').toLowerCase().includes(busca) || (v.modelo || '').toLowerCase().includes(busca));
  const exibidos = filtrados.slice(0, MAX_TABLE_ROWS);
  if ($('totalVeiculosLista')) $('totalVeiculosLista').textContent = filtrados.length;
  tbody.innerHTML = '';
  if (!filtrados.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum veículo encontrado.</td></tr>'; return; }
  exibidos.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${v.placa || '-'}</strong></td><td>${v.marca || '-'}</td><td>${v.modelo || '-'}</td>
      <td><span class="badge badge-info">${v.tipo || '-'}</span></td><td>${v.ano || '-'}</td>
      <td>${v.motorista || '-'}</td>
      <td>
        <button class="btn-icon" onclick="verDiagrama('${v.id}')" title="Ver Diagrama de Pneus">🛞</button>
        <button class="btn-icon" onclick="editarVeiculo('${v.id}')" title="Editar cadastro">✏️</button>
        <button class="btn-icon" onclick="excluirVeiculo('${v.id}')" title="Excluir">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
  if (filtrados.length > exibidos.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" class="text-center">Mostrando ${exibidos.length} de ${filtrados.length}. Use a busca para localizar um registro especifico.</td>`;
    tbody.appendChild(tr);
  }
}

function excluirVeiculo(id) {
  if (!confirm('Excluir este veículo?')) return;
  saveData(KEYS.VEICULOS, getData(KEYS.VEICULOS).filter(v => v.id !== id));
  renderVeiculos();
}

/* === DIAGRAMA DE PNEUS === */
function verDiagrama(idVeiculo) {
  const veiculos = getData(KEYS.VEICULOS);
  const veiculo = veiculos.find(v => v.id === idVeiculo);
  if (!veiculo) return;

  if ($('diagramaVeiculoPlaca')) $('diagramaVeiculoPlaca').textContent = `Veículo: ${veiculo.placa}`;
  if ($('diagramaVeiculoInfo')) $('diagramaVeiculoInfo').textContent = `${veiculo.marca} ${veiculo.modelo} - ${veiculo.tipo}`;
  if ($('btnEditarVeiculoDiagrama')) {
    $('btnEditarVeiculoDiagrama').style.display = 'inline-flex';
    $('btnEditarVeiculoDiagrama').dataset.id = veiculo.id;
  }

  renderDiagrama(veiculo);

  const btnDiagrama = $('btnTabDiagrama');
  if (btnDiagrama) {
    btnDiagrama.style.display = 'inline-block';
    btnDiagrama.click();
  } else {
    document.querySelector('.tab-btn[data-target="tab-diagrama"]')?.click();
  }
}

function voltarListaVeiculos() {
  const btnDiagrama = $('btnTabDiagrama');
  if (btnDiagrama) btnDiagrama.style.display = 'none';
  document.querySelector('.tab-btn[data-target="tab-lista"]')?.click();
}

function renderDiagrama(veiculo) {
  const container = $('diagramaContainer');
  if (!container) return;

  const pneusVeiculo = getData(KEYS.PNEUS).filter(p => p.veiculoAtual === veiculo.placa && p.statusAtual === 'Rodando');
  const estruturaEixos = gerarEixosParaVeiculo(veiculo.tipo);

  if (!estruturaEixos || estruturaEixos.length === 0) {
    container.innerHTML = `
      <div class="diagrama-empty">
        <div>⚠️</div>
        <p>Não há diagrama disponível para o tipo "${veiculo.tipo}".</p>
      </div>`;
    return;
  }

  const pneuPorPosicao = (eixoNome, codigo, nomeLocal = '') => {
    if (String(nomeLocal).toUpperCase().startsWith('STEP')) {
      const stepNumero = String(nomeLocal).match(/\d+/)?.[0] || '';
      return pneusVeiculo.find(p => {
        const local = normalizarPosicaoPneu(p.localAtual);
        const localNumero = local.match(/\d+/)?.[0] || '';
        return local.startsWith('STEP') && (!stepNumero || localNumero === stepNumero || (!localNumero && stepNumero === '1'));
      });
    }
    const alvo = normalizarPosicaoPneu(nomeLocal || `${eixoNome} - ${codigo}`);
    return pneusVeiculo.find(p => normalizarPosicaoPneu(p.localAtual) === alvo);
  };

  const htmlEixos = estruturaEixos.map(eixo => {
    return `
      <div class="diagrama-eixo-col ${eixo.tipo || ''}">
        <div class="rodas-row rodas-top">${eixo.top.map(pos => renderRodaPneu(pos, pneuPorPosicao(eixo.nome, pos.codigo, pos.nomeLocal))).join('')}</div>
        <div class="eixo-label">${eixo.nome}</div>
        <div class="rodas-row rodas-bottom">${eixo.bottom.map(pos => renderRodaPneu(pos, pneuPorPosicao(eixo.nome, pos.codigo, pos.nomeLocal))).join('')}</div>
      </div>`;
  }).join('');

  const posicoesPrevistas = estruturaEixos.flatMap(eixo => [...eixo.top, ...eixo.bottom].map(pos => ({
    eixo: eixo.nome,
    codigo: pos.codigo,
    local: pos.nomeLocal || `${eixo.nome} - ${pos.codigo}`
  })));
  const posicoesComPneu = posicoesPrevistas.map(pos => ({ ...pos, pneu: pneuPorPosicao(pos.eixo, pos.codigo, pos.local) }));
  const pneusVinculados = new Set(posicoesComPneu.filter(item => item.pneu).map(item => normalizarChave(item.pneu.numPneu)));
  const pneusSemPosicao = pneusVeiculo.filter(p => !pneusVinculados.has(normalizarChave(p.numPneu)));
  const vagas = posicoesComPneu.filter(item => !item.pneu).length;
  const cpkValidos = pneusVeiculo.map(p => ({ pneu: p, cpk: cpkPneu(p) })).filter(item => item.cpk !== null);
  const cpkMedio = cpkValidos.length ? cpkValidos.reduce((a, item) => a + item.cpk, 0) / cpkValidos.length : null;
  const linhasMapa = [...posicoesComPneu, ...pneusSemPosicao.map(pneu => ({ eixo: '-', codigo: '-', local: pneu.localAtual || 'Sem posicao', pneu }))]
    .map(item => {
      const p = item.pneu;
      const cpk = p ? cpkPneu(p) : null;
      return `<tr>
        <td>${escapeHtml(item.local || '-')}</td>
        <td>${p ? `<strong>${escapeHtml(p.numPneu)}</strong>` : '<span class="muted">Vazio</span>'}</td>
        <td>${p ? escapeHtml(p.marca || '-') : '-'}</td>
        <td>${p ? kmFormatado(p.kmRodadoTotal) : '-'}</td>
        <td>${cpk !== null ? cpkFormatado(cpk) : '-'}</td>
      </tr>`;
    }).join('');

  container.innerHTML = `
    <div class="fleet-diagram" aria-label="Diagrama de pneus do veículo ${veiculo.placa}">
      <div class="vehicle-rail"></div>
      <div class="vehicle-arrow front"></div>
      <div class="vehicle-arrow rear"></div>
      <div class="diagrama-eixos">${htmlEixos}</div>
      <div class="vehicle-id">${veiculo.placa}</div>
    </div>
    <div class="vehicle-map-summary">
      <div><span>Pneus no veiculo</span><strong>${pneusVeiculo.length}</strong></div>
      <div><span>Posicoes vazias</span><strong>${vagas}</strong></div>
      <div><span>CPK medio</span><strong>${cpkMedio !== null ? cpkFormatado(cpkMedio) : '-'}</strong></div>
      <div><span>Motorista</span><strong>${escapeHtml(veiculo.motorista || '-')}</strong></div>
    </div>
    <div class="table-container vehicle-map-table">
      <table>
        <thead><tr><th>Posicao</th><th>Fogo</th><th>Marca</th><th>KM</th><th>CPK</th></tr></thead>
        <tbody>${linhasMapa || '<tr><td colspan="5" class="text-center">Sem pneus rodando neste veiculo.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function normalizarPosicaoPneu(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/º/g, '')
    .replace(/º/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function renderRodaPneu(pos, pneu) {
  const cpkNovo = pneu ? cpkPneu(pneu) : null;
  const estadoNovo = pneu && cpkNovo === null ? 'sem-km' : pneu && cpkNovo > 0.1 ? 'alto-cpk' : '';
  const tituloNovo = pneu ? `${pos.codigo} - ${pneu.numPneu}` : `${pos.codigo} - Posicao vazia`;
  return `<div class="tire ${pneu ? 'ocupado' : 'vazio'} ${estadoNovo}" title="${escapeHtml(tituloNovo)}">
    <span>${escapeHtml(pos.codigo)}</span>
    ${pneu ? `<strong>${escapeHtml(pneu.numPneu)}</strong>` : ''}
  </div>`;
  const titulo = pneu ? `${pos.codigo} - Rodando` : `${pos.codigo} - Posição vazia`;
  return `<div class="tire ${pneu ? 'ocupado' : 'vazio'}" title="${titulo}"><span>${pos.codigo}</span></div>`;
}

function gerarEixosParaVeiculo(tipo) {
  const tipoFormatado = (tipo || '').toLowerCase();
  
  const eixoDirecional = { nome: '1º Eixo', tipo: 'simples', top: [{ codigo: 'LD' }], bottom: [{ codigo: 'LE' }] };
  const eixoTracao = (num) => ({ nome: `${num}º Eixo`, tipo: 'duplo', top: [{ codigo: 'LDF' }, { codigo: 'LDD' }], bottom: [{ codigo: 'LEF' }, { codigo: 'LED' }] });
  const eixoStep = { nome: 'Steps', tipo: 'step', top: [{ codigo: 'STEP', nomeLocal: 'STEP - 1' }], bottom: [{ codigo: 'STEP', nomeLocal: 'STEP - 2' }] };

  if (tipoFormatado === 'cavalo' || tipoFormatado.includes('toco')) {
    return [eixoDirecional, eixoTracao(2), eixoStep];
  } else if (tipoFormatado === 'carreta' || tipoFormatado === 'truck') {
    return [eixoDirecional, eixoTracao(2), eixoTracao(3), eixoStep];
  } else if (tipoFormatado === 'reboque' || tipoFormatado === 'vanderléia' || tipoFormatado === 'vanderleia') {
    return [eixoTracao(1), eixoTracao(2), eixoTracao(3), eixoStep];
  } else if (tipoFormatado === 'bitrem') {
    return [eixoDirecional, eixoTracao(2), eixoTracao(3), eixoStep, eixoTracao(4), eixoTracao(5), eixoTracao(6), eixoTracao(7), eixoTracao(8), eixoTracao(9)];
  } else {
    return [eixoDirecional, eixoTracao(2), eixoTracao(3), eixoStep];
  }
}

/* === MOTORISTAS === */
let motoristaEmEdicao = null;

function initMotoristas() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.getAttribute('data-target');
      if ($(t)) $(t).classList.add('active');
    });
  });
  if ($('btnSalvarMotorista')) $('btnSalvarMotorista').addEventListener('click', salvarMotorista);
  if ($('buscaMotorista')) $('buscaMotorista').addEventListener('input', renderMotoristas);
  if ($('filtroCatCnh')) $('filtroCatCnh').addEventListener('change', renderMotoristas);
  renderMotoristas();
}

async function salvarMotorista() {
  const nome = getVal('motoristaNome'), cpf = getVal('motoristaCpf'),
    cnh = getVal('motoristaCnh'), catCnh = getVal('motoristaCatCnh'),
    valCnh = getVal('motoristaValCnh'), tel = getVal('motoristaTel'),
    obs = getVal('motoristaObs');

  if (!nome || !cpf || !cnh) { alert('Preencha Nome, CPF e CNH.'); return; }

  const motoristaData = {
    nome,
    cpf,
    cnh,
    celular: tel,
    tipoCNH: catCnh,
    validadeCNH: valCnh,
    observacao: obs
  };

  try {
    if (motoristaEmEdicao) {
      await apiAtualizarMotorista(motoristaEmEdicao, motoristaData);
      alert('Motorista updated with success!');
      motoristaEmEdicao = null;
      if ($('btnSalvarMotorista')) $('btnSalvarMotorista').innerHTML = '💾 Salvar Motorista';
    } else {
      const motoristas = await fetchMotoristas();
      if (motoristas.some(m => m.cpf === cpf)) { alert('Motorista com este CPF já existe!'); return; }
      await apiSalvarMotorista(motoristaData);
      alert('Motorista cadastrado com sucesso!');
    }
    ['motoristaNome', 'motoristaCpf', 'motoristaCnh', 'motoristaCatCnh', 'motoristaValCnh', 'motoristaTel', 'motoristaObs'].forEach(id => setVal(id));
    await renderMotoristas();
    document.querySelector('.tab-btn[data-target="tab-lista"]')?.click();
  } catch (e) {
    alert('Erro ao salvar motorista: ' + e.message);
  }
}

async function editarMotorista(cpf) {
  try {
    const motoristas = await fetchMotoristas();
    const m = motoristas.find(x => x.cpf === cpf);
    if (!m) return;

    setVal('motoristaNome', m.nome);
    setVal('motoristaCpf', m.cpf);
    setVal('motoristaCnh', m.cnh);
    setVal('motoristaCatCnh', m.tipoCNH || '');
    setVal('motoristaValCnh', m.validadeCNH || '');
    setVal('motoristaTel', m.celular || '');
    setVal('motoristaObs', m.observacao || '');

    motoristaEmEdicao = cpf;
    if ($('btnSalvarMotorista')) $('btnSalvarMotorista').innerHTML = '💾 Atualizar Motorista';

    document.querySelector('.tab-btn[data-target="tab-cadastro"]')?.click();
  } catch (e) {
    console.error(e);
  }
}

async function renderMotoristas() {
  const tbody = $('corpoTabelaMotoristas'); if (!tbody) return;
  const motoristas = await fetchMotoristas();
  const busca = (getVal('buscaMotorista') || '').toLowerCase();
  const filtroCnh = getVal('filtroCatCnh');
  
  const filtrados = motoristas.filter(m => {
    const cat = m.tipoCNH || '';
    const matchBusca = !busca || (m.nome || '').toLowerCase().includes(busca) || (m.cpf || '').toLowerCase().includes(busca);
    const matchCat = !filtroCnh || cat === filtroCnh;
    return matchBusca && matchCat;
  });

  // Atualiza os Cards do Dashboard
  if ($('dashTotalMotoristas')) $('dashTotalMotoristas').textContent = filtrados.length;
  
  let vencidas = 0;
  let aVencer = 0;
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const daqui30Dias = new Date();
  daqui30Dias.setDate(hoje.getDate() + 30);

  // Calcula estatísticas para cards e gráfico
  const contagemCnh = {};
  
  filtrados.forEach(m => {
    if (m.validadeCNH) {
      const val = new Date(m.validadeCNH + 'T00:00:00');
      val.setHours(0,0,0,0);
      
      if (val < hoje) {
        vencidas++;
      } else if (val >= hoje && val <= daqui30Dias) {
        aVencer++;
      }
    }
    
    const cat = m.tipoCNH || 'Não informada';
    contagemCnh[cat] = (contagemCnh[cat] || 0) + 1;
  });

  if ($('dashCnhsVencidas')) $('dashCnhsVencidas').textContent = vencidas;
  if ($('dashCnhsVencer')) $('dashCnhsVencer').textContent = aVencer;

  // Atualiza Gráfico
  atualizarGraficoCnh(contagemCnh);

  tbody.innerHTML = '';
  if (!filtrados.length) { tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum motorista encontrado.</td></tr>'; return; }

  const exibidos = filtrados.slice(0, MAX_TABLE_ROWS);
  exibidos.forEach(m => {
    // Verifica se CNH está vencida
    let cnhBadge = '';
    if (m.validadeCNH) {
      const val = new Date(m.validadeCNH + 'T00:00:00');
      val.setHours(0,0,0,0);
      if (val < hoje) cnhBadge = '<span class="badge badge-danger">Vencida</span>';
      else if (val >= hoje && val <= daqui30Dias) cnhBadge = '<span class="badge badge-warning">Vence em breve</span>';
      else cnhBadge = '<span class="badge badge-success">Regular</span>';
    }

    const obsTexto = m.observacao ? m.observacao : 'Sem observações';
    const obsHtml = m.observacao ? `<span title="${m.observacao}">${m.observacao.substring(0,20)}${m.observacao.length > 20 ? '...' : ''}</span>` : `<span style="color:#94a3b8;font-style:italic;">${obsTexto}</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${m.nome || '-'}</strong></td><td>${m.cpf || '-'}</td><td>${m.cnh || '-'}</td>
      <td><span class="badge badge-info">${m.tipoCNH || '-'}</span></td>
      <td>${m.validadeCNH ? new Date(m.validadeCNH + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} ${cnhBadge}</td>
      <td>${m.celular || '-'}</td>
      <td>${obsHtml}</td>
      <td>
        <button class="btn-icon" onclick="editarMotorista('${m.cpf}')" title="Editar">✏️</button>
        <button class="btn-icon" onclick="excluirMotorista('${m.cpf}')" title="Excluir">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
  if (filtrados.length > exibidos.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" class="text-center">Mostrando ${exibidos.length} de ${filtrados.length}. Use a busca ou filtro de CNH para localizar um registro especifico.</td>`;
    tbody.appendChild(tr);
  }
}

let graficoCnhInstancia = null;
function atualizarGraficoCnh(dados) {
  const ctx = $('graficoCatCnh');
  if (!ctx || typeof Chart === 'undefined') return;

  const labels = Object.keys(dados);
  const valores = Object.values(dados);

  if (graficoCnhInstancia) {
    graficoCnhInstancia.data.labels = labels;
    graficoCnhInstancia.data.datasets[0].data = valores;
    graficoCnhInstancia.update();
  } else {
    graficoCnhInstancia = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Quantidade',
          data: valores,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }
}

async function excluirMotorista(cpf) {
  if (!confirm('Excluir este motorista?')) return;
  try {
    await apiExcluirMotorista(cpf);
    await renderMotoristas();
  } catch (e) {
    alert('Erro ao excluir motorista: ' + e.message);
  }
}

/* === PNEUS === */
function initCadastroPneu() {
  if ($('btnSalvarCadastro')) $('btnSalvarCadastro').addEventListener('click', salvarPneu);
  if ($('codSistema')) setVal('codSistema', 'PNEU-' + Date.now());
}

/* Página unificada pneus.html — abas + cadastro + lista */
function initPneus() {
  // Ativar sistema de abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.getAttribute('data-target');
      if ($(t)) $(t).classList.add('active');
    });
  });
  // Cadastro
  if ($('btnSalvarCadastro')) $('btnSalvarCadastro').addEventListener('click', salvarPneu);
  if ($('codSistema')) setVal('codSistema', 'PNEU-' + Date.now());
  // Lista
  initConsultaPneus();
  if ($('btnBuscarDetalhePneu')) $('btnBuscarDetalhePneu').addEventListener('click', () => renderDetalhePneu(getVal('detalhePneuBusca')));
  if ($('detalhePneuBusca')) {
    $('detalhePneuBusca').addEventListener('keydown', event => {
      if (event.key === 'Enter') renderDetalhePneu(getVal('detalhePneuBusca'));
    });
  }
}

async function salvarPneu(event) {
  const botao = event?.currentTarget || $('btnSalvarCadastro');
  const p = {
    id: gerarId(), codSistema: getVal('codSistema'), numPneu: getVal('numPneu'), marca: getVal('marca'),
    modelo: getVal('modelo'), tipo: getVal('tipo'), medida: getVal('medida'), dataCompra: getVal('dataCompra'),
    valorCompra: Number(getVal('valorCompra')) || 0, kmCompra: Number(getVal('kmCompra')) || 0,
    fornecedorCompra: getVal('fornecedorCompra'), notaFiscalCompra: getVal('notaFiscalCompra'), observacaoCompra: getVal('observacaoCompra'),
    dot: getVal('dot'), serie: getVal('serie'),
    profundidadeInicial: Number(getVal('profundidade')) || 0, profundidadeAtual: Number(getVal('profundidade')) || 0,
    statusAtual: 'Estoque', veiculoAtual: '-', localAtual: 'Estoque', recapagens: [],
    kmAtual: Number(getVal('kmCompra')) || 0, kmBaixa: null, kmRodadoTotal: null, custoPorKm: null,
    dataUltimaMovimentacao: ''
  };
  const pneus = getData(KEYS.PNEUS);
  const erros = validarCadastroPneu(p, pneus);
  if (erros.length) {
    notificar(erros[0], 'error');
    return;
  }

  if (!setBotaoCarregando(botao, true, 'Salvando pneu...')) return;
  try {
    const salvo = await apiSalvarPneu(p);
    pneus.push(normalizarPneu(salvo));
    saveData(KEYS.PNEUS, pneus);
    notificar('Pneu cadastrado no banco com sucesso.', 'success');
    setVal('codSistema', 'PNEU-' + Date.now());
    ['numPneu', 'marca', 'modelo', 'dot', 'serie', 'dataCompra', 'valorCompra', 'kmCompra', 'profundidade', 'fornecedorCompra', 'notaFiscalCompra', 'observacaoCompra'].forEach(id => setVal(id));
    renderPneus();
  } catch (error) {
    notificar(error.message || 'Erro ao salvar pneu.', 'error');
  } finally {
    setBotaoCarregando(botao, false);
  }
}

function initConsultaPneus() {
  renderPneus();
  ['filtroPneu', 'filtroMarca', 'filtroStatus', 'filtroVeiculo', 'filtroPerformance'].forEach(id => {
    if ($(id)) { $(id).addEventListener('input', renderPneus); $(id).addEventListener('change', renderPneus); }
  });
}

function renderPneus() {
  const tbody = $('corpoTabelaPneus'); if (!tbody) return;
  const pneus = getData(KEYS.PNEUS);
  const fN = (getVal('filtroPneu') || '').toLowerCase(), fM = (getVal('filtroMarca') || '').toLowerCase(),
    fS = getVal('filtroStatus'), fV = (getVal('filtroVeiculo') || '').toLowerCase(), fP = getVal('filtroPerformance');
  const kms = pneus.map(p => asNumber(p.kmRodadoTotal)).filter(km => km > 0);
  const kmMedio = kms.length ? kms.reduce((a, km) => a + km, 0) / kms.length : 0;
  const pneusComCpk = pneus.filter(p => cpkPneu(p) !== null);
  const cpkKm = pneusComCpk.reduce((a, p) => a + asNumber(p.kmRodadoTotal), 0);
  const cpkCusto = pneusComCpk.reduce((a, p) => a + custoTotalPneu(p), 0);
  const cpkMedio = cpkKm > 0 ? cpkCusto / cpkKm : 0;
  const atendePerformance = p => {
    const km = asNumber(p.kmRodadoTotal);
    const cpk = cpkPneu(p);
    if (!fP) return true;
    if (fP === 'sem-km') return km <= 0 && p.statusAtual !== 'Estoque';
    if (fP === 'alto-cpk') return cpk !== null && cpkMedio > 0 && cpk > cpkMedio * 1.25;
    if (fP === 'alto-km') return kmMedio > 0 && km > kmMedio * 1.35;
    if (fP === 'recapado') return quantidadeRecapagensPneu(p) > 0;
    return true;
  };
  const f = pneus.filter(p => (!fN || (p.numPneu || '').toLowerCase().includes(fN)) && (!fM || (p.marca || '').toLowerCase().includes(fM))
    && (!fS || p.statusAtual === fS) && (!fV || (p.veiculoAtual || '').toLowerCase().includes(fV)) && atendePerformance(p));
  const exibidos = f.slice(0, MAX_TABLE_ROWS);
  tbody.innerHTML = '';
  if (!f.length) { tbody.innerHTML = '<tr><td colspan="11" class="text-center">Nenhum pneu encontrado.</td></tr>'; return; }
  exibidos.forEach(p => {
    const bc = statusBadgeClass(p.statusAtual);
    const cpk = cpkPneu(p);
    const diagnostico = diagnosticoPneu(p, { kmMedio, cpkMedio });
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${p.numPneu}</strong></td><td>${p.marca}</td><td>${p.modelo || '-'}</td>
      <td>${p.medida || '-'}</td><td><span class="badge ${bc}">${p.statusAtual}</span></td>
      <td>${p.veiculoAtual}</td><td>${kmFormatado(p.kmRodadoTotal)}</td><td>${moeda(custoTotalPneu(p))}</td>
      <td>${cpk !== null ? cpkFormatado(cpk) : '-'}</td><td><span class="badge ${diagnostico.classe}">${diagnostico.texto}</span></td>
      <td><button class="btn-icon" onclick="verDetalhesPneu('${p.numPneu}')">📋</button></td>`;
    tbody.appendChild(tr);
  });
  if (f.length > exibidos.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="11" class="text-center">Mostrando ${exibidos.length} de ${f.length}. Use os filtros para localizar um pneu específico.</td>`;
    tbody.appendChild(tr);
  }
}

function verDetalhesPneu(num) {
  renderDetalhePneu(num);
  document.querySelector('.tab-btn[data-target="tab-detalhe"]')?.click();
  return;
  const pneu = getData(KEYS.PNEUS).find(p => normalizarChave(p.numPneu) === normalizarChave(num));
  const movs = getData(KEYS.MOVS).filter(m => (m.numeroPneu || m.id_pneu) === num);
  if (!pneu) {
    alert(`Pneu ${num}: ${movs.length} movimentação(ões) registrada(s).`);
    return;
  }
  const cpk = cpkPneu(pneu);
  alert([
    `Pneu ${num}`,
    `Status: ${pneu.statusAtual || '-'}`,
    `Veículo/local: ${pneu.veiculoAtual || '-'} / ${pneu.localAtual || '-'}`,
    `KM rodado: ${kmFormatado(pneu.kmRodadoTotal)}`,
    `Custo total: ${moeda(custoTotalPneu(pneu))}`,
    `CPK: ${cpk !== null ? cpkFormatado(cpk) : 'sem KM'}`,
    `Movimentações: ${movs.length}`
  ].join('\n'));
}

/* === MOVIMENTAÇÃO === */
function movimentosDoPneu(num) {
  const chave = normalizarChave(num);
  return ordenarMovimentacoesRecentes(getData(KEYS.MOVS)
    .filter(m => normalizarChave(m.numeroPneu || m.id_pneu) === chave));
}

function contextoOperacionalPneus() {
  const pneus = getData(KEYS.PNEUS);
  const kms = pneus.map(p => asNumber(p.kmRodadoTotal)).filter(km => km > 0);
  const kmMedio = kms.length ? kms.reduce((a, km) => a + km, 0) / kms.length : 0;
  const pneusComCpk = pneus.filter(p => cpkPneu(p) !== null);
  const cpkKm = pneusComCpk.reduce((a, p) => a + asNumber(p.kmRodadoTotal), 0);
  const cpkCusto = pneusComCpk.reduce((a, p) => a + custoTotalPneu(p), 0);
  return { kmMedio, cpkMedio: cpkKm > 0 ? cpkCusto / cpkKm : 0 };
}

function renderDetalheLinha(label, valor) {
  return `<div class="detail-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(valor || '-')}</strong></div>`;
}

function renderDetalhePneu(num) {
  const panel = $('pneuDetalhePanel');
  if (!panel) return;
  const chave = normalizarChave(num || getVal('detalhePneuBusca'));
  if (!chave) {
    panel.innerHTML = '<div class="empty-state">Digite o fogo do pneu para consultar.</div>';
    return;
  }

  const pneu = getData(KEYS.PNEUS).find(p => normalizarChave(p.numPneu) === chave);
  const movs = movimentosDoPneu(chave);
  if (!pneu) {
    panel.innerHTML = `<div class="empty-state">Pneu nao encontrado. Movimentacoes localizadas: ${movs.length}.</div>`;
    return;
  }

  const cpk = cpkPneu(pneu);
  const recaps = movs.filter(m => (m.tipo_movimentacao || m.tipoMov) === 'Recapagem');
  const custoRecap = asNumber(pneu.custoRecapagens) || recaps.reduce((a, m) => a + asNumber(m.valorRecape), 0);
  const ultima = movs[0];
  const diagnostico = diagnosticoPneu(pneu, contextoOperacionalPneus());
  setVal('detalhePneuBusca', pneu.numPneu);

  const linhasMov = movs.slice(0, 80).map(m => {
    const tipo = tipoMovimentacaoLabel(m.tipo_movimentacao || m.tipoMov);
    const destino = destinoMovimentacaoTabela(m) || '-';
    const local = localDestinoMovimentacao(m) || '-';
    const km = kmMovimentacao(m);
    return `<tr>
      <td>${escapeHtml(formatarDataDashboard(obterDataMovimentacao(m)))}</td>
      <td><span class="badge ${movimentacaoBadgeClass(m.tipo_movimentacao || m.tipoMov)}">${escapeHtml(tipo)}</span></td>
      <td>${escapeHtml(destino)}</td>
      <td>${escapeHtml(local)}</td>
      <td>${escapeHtml(km > 0 ? kmFormatado(km) : '-')}</td>
      <td>${escapeHtml(m.observacao || '')}</td>
    </tr>`;
  }).join('');

  panel.innerHTML = `
    <div class="pneu-detail-hero">
      <div>
        <span class="section-kicker">Raio-X do pneu</span>
        <h2>${escapeHtml(pneu.numPneu)}</h2>
        <p>${escapeHtml([pneu.marca, pneu.modelo, pneu.medida].filter(Boolean).join(' - ') || 'Cadastro sem detalhes')}</p>
      </div>
      <span class="badge ${statusBadgeClass(pneu.statusAtual)}">${escapeHtml(pneu.statusAtual || '-')}</span>
    </div>

    <div class="detail-kpi-grid">
      <div class="detail-kpi"><span>Local atual</span><strong>${escapeHtml(pneu.veiculoAtual || '-')}</strong><small>${escapeHtml(pneu.localAtual || '-')}</small></div>
      <div class="detail-kpi"><span>KM rodado</span><strong>${kmFormatado(pneu.kmRodadoTotal)}</strong><small>Baseado nos lancamentos</small></div>
      <div class="detail-kpi"><span>Custo total</span><strong>${moeda(custoTotalPneu(pneu))}</strong><small>Compra + recapagens</small></div>
      <div class="detail-kpi"><span>CPK</span><strong>${cpk !== null ? cpkFormatado(cpk) : '-'}</strong><small>${escapeHtml(diagnostico.texto)}</small></div>
    </div>

    <div class="detail-grid">
      <section class="detail-box">
        <h3>Compra</h3>
        ${renderDetalheLinha('Data', formatarDataDashboard(pneu.dataCompra))}
        ${renderDetalheLinha('Valor', moeda(pneu.valorCompra))}
        ${renderDetalheLinha('Fornecedor', pneu.fornecedorCompra)}
        ${renderDetalheLinha('Nota fiscal', pneu.notaFiscalCompra)}
        ${renderDetalheLinha('KM compra', kmFormatado(pneu.kmCompra))}
        ${renderDetalheLinha('Observacao', pneu.observacaoCompra)}
      </section>
      <section class="detail-box">
        <h3>Vida do pneu</h3>
        ${renderDetalheLinha('Recapagens/consertos', String(quantidadeRecapagensPneu(pneu) || recaps.length))}
        ${renderDetalheLinha('Custo recapagens', moeda(custoRecap))}
        ${renderDetalheLinha('Ultima movimentacao', ultima ? `${formatarDataDashboard(obterDataMovimentacao(ultima))} - ${tipoMovimentacaoLabel(ultima.tipo_movimentacao || ultima.tipoMov)}` : '-')}
        ${renderDetalheLinha('Movimentacoes', String(movs.length))}
        ${renderDetalheLinha('Diagnostico', diagnostico.texto)}
      </section>
    </div>

    <section class="detail-box">
      <h3>Historico de movimentacoes</h3>
      <div class="table-container">
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Veiculo</th><th>Local</th><th>KM</th><th>Obs.</th></tr></thead>
          <tbody>${linhasMov || '<tr><td colspan="6" class="text-center">Sem movimentacoes registradas.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
}

let movEmEdicao = null;

function initMovimentacao() {
  // Suporte a abas na movimentação
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.getAttribute('data-target');
      if ($(t)) $(t).classList.add('active');
    });
  });

  if ($('btnSalvarMov')) $('btnSalvarMov').addEventListener('click', salvarMovimentacao);
  if ($('numeroPneu')) $('numeroPneu').addEventListener('blur', () => preencherDadosAnteriores(getVal('numeroPneu')));
  ['lado', 'eixo', 'stepNumero'].forEach(id => { if ($(id)) $(id).addEventListener('change', atualizarLocal); });
  popularSelectVeiculos();
  renderPneusMov();
  if ($('buscaPneuMov')) $('buscaPneuMov').addEventListener('input', renderPneusMov);
  [
    'buscaHistoricoMov',
    'filtroMovDataInicial',
    'filtroMovDataFinal',
    'filtroMovPneu',
    'filtroMovVeiculo',
    'filtroMovLocal',
    'filtroMovTipo'
  ].forEach(id => {
    if ($(id)) {
      $(id).addEventListener('input', renderHistoricoMov);
      $(id).addEventListener('change', renderHistoricoMov);
    }
  });
  document.querySelectorAll('input[name="filtroMovSituacao"]').forEach(input => {
    input.addEventListener('change', renderHistoricoMov);
  });
  renderHistoricoMov();
}

function popularSelectVeiculos(filtroMotorista = '') {
  document.querySelectorAll('.select-veiculos').forEach(sel => {
    const veiculosTodos = getData(KEYS.VEICULOS);
    const motorista = normalizarChave(filtroMotorista);
    const vinculados = motorista ? veiculosTodos.filter(v => {
      const nomeVinculado = normalizarChave(v.motorista);
      return nomeVinculado && (nomeVinculado.includes(motorista) || motorista.includes(nomeVinculado));
    }) : [];
    const veiculos = vinculados.length ? vinculados : veiculosTodos;
    const val = sel.value;
    sel.innerHTML = '<option value="">Selecione...</option>' + veiculos.map(v => `<option value="${v.placa}">${v.placa} - ${v.modelo}</option>`).join('');
    if (val) sel.value = val;
  });
}

function preencherDadosAnteriores(num) {
  const p = getData(KEYS.PNEUS).find(x => x.numPneu === num);
  if (p) { setVal('veiculoAnterior', p.veiculoAtual || 'Estoque'); setVal('localAnterior', p.localAtual || 'Estoque'); }
  else { setVal('veiculoAnterior', 'Estoque'); setVal('localAnterior', 'Estoque'); }
}

function toggleStepField() {
  const eixo = getVal('eixo');
  const isStep = eixo === 'STEP';
  const groupStep = $('stepNumeroGroup');
  if (groupStep) groupStep.style.display = isStep ? '' : 'none';
  if (!isStep && $('stepNumero')) setVal('stepNumero', '');
  atualizarLocal();
}

function atualizarLocal() {
  const eixo = getVal('eixo'), l = getVal('lado'), sn = getVal('stepNumero'), c = $('localAtual');
  if (!c) return;
  if (eixo === 'STEP') { c.value = sn ? `STEP - ${sn}` : 'STEP'; }
  else { c.value = eixo && l ? `${eixo} - ${l}` : ''; }
}

async function salvarMovimentacao(event) {
  const botao = event?.currentTarget || $('btnSalvarMov');
  const dataMov = getVal('dataMov'), numeroPneu = getVal('numeroPneu'), tipoMov = getVal('tipoMov');

  const kmVeiculo = Number(getVal('kmVeiculo')) || 0;

  const m = {
    id: movEmEdicao || gerarId(),
    data_movimentacao: dataMov,
    // compatibilidade legada
    dataMov,
    numeroPneu,
    id_pneu: numeroPneu,
    tipo_movimentacao: tipoMov,
    tipoMov,
    placa_veiculo: getVal('veiculoAtual'),
    posicao: getVal('localAtual'),
    km_entrada: (tipoMov === 'Instalacao') ? kmVeiculo : 0,
    km_saida: (tipoMov === 'Retirada' || tipoMov === 'Baixa' || tipoMov === 'Atualizacao') ? kmVeiculo : 0,
    veiculoAnterior: getVal('veiculoAnterior'), localAnterior: getVal('localAnterior'),
    tipoVeiculo: getVal('tipoVeiculo'), veiculoAtual: getVal('veiculoAtual'),
    lado: getVal('lado'), eixo: getVal('eixo'), stepNumero: getVal('stepNumero'), localAtual: getVal('localAtual'),
    profundidade: Number(getVal('profundidade')) || 0,
    valorRecape: Number(getVal('valorRecape')) || 0,
    fornecedorRecape: getVal('fornecedorRecape'),
    tipoServicoRecape: getVal('tipoServicoRecape') || 'Recapagem',
    observacao: getVal('observacao')
  };

  const pneus = getData(KEYS.PNEUS), idx = pneus.findIndex(p => normalizarChave(p.numPneu) === normalizarChave(numeroPneu));
  const pneuAtual = idx >= 0 ? pneus[idx] : null;
  const erros = validarMovimentacaoFormulario(m, pneuAtual, !!movEmEdicao);
  if (erros.length) {
    notificar(erros[0], 'error');
    return;
  }

  if (!setBotaoCarregando(botao, true, movEmEdicao ? 'Atualizando...' : 'Salvando movimentação...')) return;

  if (!movEmEdicao) {
    try {
      const salvoBanco = await apiSalvarMovimentacao(m);
      if (salvoBanco && salvoBanco.id) m.id = salvoBanco.id;
    } catch (error) {
      notificar(error.message || 'Erro ao salvar movimentação.', 'error');
      setBotaoCarregando(botao, false);
      return;
    }
  }

  const movs = getData(KEYS.MOVS);
  const recapagens = getData(KEYS.RECAPAGENS);

  if (movEmEdicao) {
    try {
      const atualizadoBanco = await apiAtualizarMovimentacao(movEmEdicao, m);
      if (atualizadoBanco && atualizadoBanco.id) {
        Object.assign(m, normalizarMovimentacao(atualizadoBanco));
      }
    } catch (error) {
      notificar(error.message || 'Erro ao atualizar movimentação.', 'error');
      setBotaoCarregando(botao, false);
      return;
    }

    const mIdx = movs.findIndex(x => x.id === movEmEdicao);
    if (mIdx !== -1) { movs[mIdx] = m; notificar('Movimentação atualizada no banco.', 'success'); }
    movEmEdicao = null;
    if ($('btnSalvarMov')) $('btnSalvarMov').innerHTML = '💾 Salvar Movimentação';
    await sincronizarDadosBanco(['pneus', 'movimentacoes']);
    renderPneusMov();
    renderHistoricoMov();
    ['numeroPneu', 'dataMov', 'tipoMov', 'veiculoAtual', 'tipoVeiculo', 'eixo', 'stepNumero', 'lado',
      'localAtual', 'profundidade', 'observacao', 'valorRecape', 'fornecedorRecape', 'kmVeiculo'].forEach(id => setVal(id));
    setBotaoCarregando(botao, false);
    if (botao && botao.id === 'btnSalvarMov') {
      botao.innerHTML = paginaAtualEhMotorista() ? 'Salvar movimentacao' : '💾 Salvar Movimentação';
    }
    return;
  } else {
    movs.push(m);

    // === NOVA TABELA: recapagens_custos ===
    if (tipoMov === 'Recapagem') {
      const valorRecape = Number(getVal('valorRecape')) || 0;
      const fornecedor = getVal('fornecedorRecape');
      const tipoServico = getVal('tipoServicoRecape') || 'Recapagem';
      if (valorRecape > 0 || fornecedor) {
        recapagens.push({
          id: gerarId(),
          id_pneu: numeroPneu,
          tipo_servico: tipoServico,
          valor: valorRecape,
          fornecedor: fornecedor,
          data_servico: dataMov,
          // mantido para relatórios
          marcaRecape: fornecedor
        });
      }
    }
    notificar('Movimentação salva no banco com sucesso.', 'success');
  }

  // === Atualiza o pneu com os efeitos da movimentação ===
  const p = pneus[idx];
  p.dataUltimaMovimentacao = dataMov;

  if (tipoMov === 'Baixa') {
    // Usa kmVeiculo se informado, senão mantém o que tinha
    const kmFinal = kmVeiculo > 0 ? kmVeiculo : (p.kmBaixa || 0);
    p.statusAtual = 'Baixado';
    p.veiculoAtual = '-';
    p.localAtual = '-';
    p.kmBaixa = kmFinal;
    // Calcular KM rodado real a partir do histórico de movimentações
    p.kmRodadoTotal = calcularKmRodadoPneu(numeroPneu, movs, kmFinal, p.kmCompra);
    // CPK provisório (será recalculado no relatório com recapagens)
    const custoRecapes = recapagens.filter(r => r.id_pneu === numeroPneu).reduce((a, r) => a + (r.valor || 0), 0);
    const custoTotal = (p.valorCompra || 0) + custoRecapes;
    if (p.kmRodadoTotal > 0) p.custoPorKm = custoTotal / p.kmRodadoTotal;

  } else if (tipoMov === 'Recapagem') {
    p.statusAtual = 'Recapado';
    if (m.profundidade) p.profundidadeAtual = m.profundidade;
    p.quantidade_recapagens = (p.quantidade_recapagens || 0) + 1;
    // Mantém compatibilidade com campo legado
    if (!p.recapagens) p.recapagens = [];
    p.recapagens.push({ data: dataMov, valor: Number(getVal('valorRecape')) || 0, marca: getVal('fornecedorRecape') });

  } else if (tipoMov === 'Retirada') {
    p.statusAtual = 'Estoque';
    p.veiculoAtual = 'Estoque';
    p.localAtual = 'Estoque';
    if (m.profundidade) p.profundidadeAtual = m.profundidade;

  } else if (tipoMov === 'Atualizacao') {
    if (m.localAtual) p.localAtual = m.localAtual;
    if (m.profundidade) p.profundidadeAtual = m.profundidade;

  } else if (tipoMov === 'Instalacao') {
    p.statusAtual = 'Rodando';
    p.veiculoAtual = m.veiculoAtual;
    p.localAtual = m.localAtual;
    if (m.profundidade) p.profundidadeAtual = m.profundidade;
    // Guarda o KM de entrada para cálculo futuro
    if (kmVeiculo > 0) p.kmEntradaAtual = kmVeiculo;
  }

  pneus[idx] = p;
  saveData(KEYS.PNEUS, pneus);
  saveData(KEYS.MOVS, movs);
  saveData(KEYS.RECAPAGENS, recapagens);

  await sincronizarDadosBanco(['pneus', 'movimentacoes']);
  atualizarDashboard();
  renderPneusMov();
  renderHistoricoMov();

  // Limpar formulário
  ['numeroPneu', 'dataMov', 'tipoMov', 'veiculoAtual', 'tipoVeiculo', 'eixo', 'stepNumero', 'lado',
    'localAtual', 'profundidade', 'observacao', 'valorRecape', 'fornecedorRecape', 'kmVeiculo'].forEach(id => setVal(id));
  if (paginaAtualEhMotorista()) {
    if ($('dataMov')) $('dataMov').value = new Date().toISOString().split('T')[0];
    if ($('tipoMov')) $('tipoMov').value = 'Instalacao';
    if (typeof toggleDriverMovFields === 'function') toggleDriverMovFields();
    renderHistoricoMotorista();
  } else {
    document.querySelector('.tab-btn[data-target="tab-lista"]')?.click();
  }

  setBotaoCarregando(botao, false);
  if (botao && botao.id === 'btnSalvarMov') {
    botao.innerHTML = paginaAtualEhMotorista() ? 'Salvar movimentacao' : '💾 Salvar Movimentação';
  }
}

/**
 * Calcula o KM total rodado por um pneu usando o histórico de movimentações.
 * Soma (km_saida - km_entrada) de cada ciclo de instalação/retirada.
 * @param {string} numPneu
 * @param {Array} movs - lista de movimentações
 * @param {number} kmFinalBaixa - km final caso seja baixa
 * @param {number} kmCompra - km inicial do pneu
 */
function calcularKmRodadoPneu(numPneu, movs, kmFinalBaixa, kmCompra) {
  const hist = movs.filter(m => m.id_pneu === numPneu || m.numeroPneu === numPneu)
    .sort((a, b) => (a.data_movimentacao || a.dataMov || '').localeCompare(b.data_movimentacao || b.dataMov || ''));
  let kmTotal = 0;
  let kmEntrada = null;

  for (const mov of hist) {
    const tipo = mov.tipo_movimentacao || mov.tipoMov;
    if (tipo === 'Instalacao' && (mov.km_entrada || 0) > 0) {
      kmEntrada = mov.km_entrada;
    } else if ((tipo === 'Retirada' || tipo === 'Baixa')) {
      const kmSaida = (tipo === 'Baixa' && kmFinalBaixa > 0) ? kmFinalBaixa : (mov.km_saida || 0);
      if (kmEntrada !== null && kmSaida > kmEntrada) {
        kmTotal += kmSaida - kmEntrada;
        kmEntrada = null;
      }
    }
  }
  // Se ainda há uma entrada sem saída, usa o km final de baixa
  if (kmEntrada !== null && kmFinalBaixa > kmEntrada) {
    kmTotal += kmFinalBaixa - kmEntrada;
  }
  // Fallback: se não há histórico de km, usa método simples
  return kmTotal > 0 ? kmTotal : Math.max(0, kmFinalBaixa - (kmCompra || 0));
}

function renderPneusMov() {
  const t = $('tabelaPneusMov'); if (!t) return;
  const pneus = getData(KEYS.PNEUS), b = (getVal('buscaPneuMov') || '').toLowerCase();
  const f = pneus.filter(p => !b || (p.numPneu || '').toLowerCase().includes(b) || (p.marca || '').toLowerCase().includes(b));
  const exibidos = f.slice(0, MAX_TABLE_ROWS);
  t.innerHTML = '';
  if (!f.length) { t.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum pneu.</td></tr>'; return; }
  exibidos.forEach(p => {
    const bc = p.statusAtual === 'Rodando' ? 'badge-success' : p.statusAtual === 'Estoque' ? 'badge-warning' : 'badge-danger';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.numPneu}</td><td>${p.marca}</td><td><span class="badge ${bc}">${p.statusAtual}</span></td>
      <td>${p.veiculoAtual}</td><td><button class="btn-icon" onclick="selecionarPneu('${p.numPneu}')">✏️</button></td>`;
    t.appendChild(tr);
  });
  if (f.length > exibidos.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="text-center">Mostrando ${exibidos.length} de ${f.length}. Use a busca para localizar um pneu especifico.</td>`;
    t.appendChild(tr);
  }
}

function selecionarPneu(num) { setVal('numeroPneu', num); preencherDadosAnteriores(num); }

function kmMovimentacao(m) {
  return asNumber(m.km_entrada) || asNumber(m.km_saida) || asNumber(m.km) || 0;
}

function origemMovimentacao(m) {
  const anterior = m.veiculoAnterior || m.PlacaCavaloAnt || '';
  return anterior && anterior !== '0' ? anterior : 'Estoque';
}

function localOrigemMovimentacao(m) {
  const local = m.localAnterior || m.LocalAnt || '';
  return local && local !== '0' ? local : 'Estoque';
}

function destinoMovimentacaoTabela(m) {
  const tipo = m.tipo_movimentacao || m.tipoMov || '';
  if (tipo === 'Baixa') return 'Baixado';
  if (tipo === 'Retirada') return 'Estoque';
  const destino = m.veiculoAtual || m.placa_veiculo || '';
  return destino && destino !== '0' ? destino : 'Estoque';
}

function localDestinoMovimentacao(m) {
  const tipo = m.tipo_movimentacao || m.tipoMov || '';
  if (tipo === 'Baixa') return 'Sucata';
  if (tipo === 'Retirada') return 'Estoque';
  const local = m.localAtual || m.posicao || '';
  return local && local !== '0' ? local : '-';
}

function classeBadgeTipoMov(tipoMov) {
  return tipoMov === 'Instalacao' ? 'badge-success' :
    tipoMov === 'Retirada' ? 'badge-warning' :
      tipoMov === 'Baixa' ? 'badge-danger' :
        tipoMov === 'Recapagem' ? 'badge-purple' : 'badge-info';
}

function limparFiltrosMovimentacoes() {
  ['filtroMovDataInicial', 'filtroMovDataFinal', 'filtroMovPneu', 'filtroMovVeiculo', 'filtroMovLocal', 'filtroMovTipo', 'buscaHistoricoMov']
    .forEach(id => setVal(id));
  const todos = document.querySelector('input[name="filtroMovSituacao"][value=""]');
  if (todos) todos.checked = true;
  renderHistoricoMov();
}

function renderHistoricoMov() {
  const tbody = $('tabelaHistoricoMov');
  if (!tbody) return;

  const movs = ordenarMovimentacoesRecentes(getData(KEYS.MOVS));
  const busca = (getVal('buscaHistoricoMov') || '').toLowerCase();
  const filtroPneu = (getVal('filtroMovPneu') || '').toLowerCase();
  const filtroVeiculo = (getVal('filtroMovVeiculo') || '').toLowerCase();
  const filtroLocal = (getVal('filtroMovLocal') || '').toLowerCase();
  const filtroTipo = getVal('filtroMovTipo');
  const dataInicial = getVal('filtroMovDataInicial');
  const dataFinal = getVal('filtroMovDataFinal');

  const filtrados = movs.filter(m => {
    const tipo = m.tipo_movimentacao || m.tipoMov || '';
    const data = obterDataMovimentacao(m);
    const pneu = String(m.numeroPneu || m.id_pneu || '').toLowerCase();
    const veiculos = `${origemMovimentacao(m)} ${destinoMovimentacaoTabela(m)}`.toLowerCase();
    const locais = `${localOrigemMovimentacao(m)} ${localDestinoMovimentacao(m)}`.toLowerCase();
    const texto = `${pneu} ${tipo} ${veiculos} ${locais} ${m.observacao || ''}`.toLowerCase();

    return (!busca || texto.includes(busca)) &&
      (!filtroPneu || pneu.includes(filtroPneu)) &&
      (!filtroVeiculo || veiculos.includes(filtroVeiculo)) &&
      (!filtroLocal || locais.includes(filtroLocal)) &&
      (!filtroTipo || tipo === filtroTipo) &&
      (!dataInicial || data >= dataInicial) &&
      (!dataFinal || data <= dataFinal);
  });
  const exibidos = filtrados.slice(0, MAX_TABLE_ROWS);
  if ($('totalMovimentacoesConsulta')) {
    $('totalMovimentacoesConsulta').textContent = filtrados.length === 1
      ? '1 movimentação'
      : `${filtrados.length.toLocaleString('pt-BR')} movimentações`;
  }

  tbody.innerHTML = '';
  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center">Nenhuma movimentação encontrada.</td></tr>';
    return;
  }

  exibidos.forEach(m => {
    const tipoMov = m.tipo_movimentacao || m.tipoMov || '';
    const dataMov = obterDataMovimentacao(m);
    const numPneu = m.id_pneu || m.numeroPneu || '';
    const km = kmMovimentacao(m);
    const badgeType = classeBadgeTipoMov(tipoMov);
    const tipoLabel = tipoMovimentacaoLabel(tipoMov);
    const movId = m.id || '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(movId)}</strong></td>
      <td>${dataMov ? new Date(dataMov + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
      <td><span class="badge ${badgeType}">${tipoLabel}</span></td>
      <td>${escapeHtml(numPneu)}</td>
      <td>${km > 0 ? km.toLocaleString('pt-BR') : '-'}</td>
      <td>${escapeHtml(origemMovimentacao(m))}</td>
      <td>${escapeHtml(localOrigemMovimentacao(m))}</td>
      <td>${escapeHtml(destinoMovimentacaoTabela(m))}</td>
      <td>${escapeHtml(localDestinoMovimentacao(m))}</td>
      <td style="max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(m.observacao || '')}">${escapeHtml(m.observacao || '-')}</td>
      <td>
        <button class="btn-icon" onclick="editarMovimentacao('${escapeHtml(m.id)}')" title="Editar">✏️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (filtrados.length > exibidos.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="11" class="text-center">Mostrando ${exibidos.length} de ${filtrados.length}. Use os filtros para localizar uma movimentação específica.</td>`;
    tbody.appendChild(tr);
  }
}

function editarMovimentacao(id) {
  const movs = getData(KEYS.MOVS);
  const m = movs.find(x => x.id === id);
  if (!m) return;

  // Suporte a campos novos e legados
  const tipoMov = m.tipo_movimentacao || m.tipoMov || '';
  const dataMov = m.data_movimentacao || m.dataMov || '';
  const numPneu = m.id_pneu || m.numeroPneu || '';

  setVal('numeroPneu', numPneu);
  setVal('dataMov', dataMov);
  setVal('tipoMov', tipoMov);
  setVal('veiculoAnterior', m.veiculoAnterior);
  setVal('localAnterior', m.localAnterior);
  setVal('tipoVeiculo', m.tipoVeiculo);

  popularSelectVeiculos();
  setVal('veiculoAtual', m.placa_veiculo || m.veiculoAtual);
  setVal('eixo', m.eixo);
  toggleStepField();
  setVal('stepNumero', m.stepNumero);
  setVal('lado', m.lado);
  setVal('localAtual', m.posicao || m.localAtual);
  setVal('profundidade', m.profundidade);
  setVal('observacao', m.observacao);
  // Campos novos
  setVal('kmVeiculo', m.km_entrada || m.km_saida || '');
  setVal('valorRecape', m.valorRecape || '');
  setVal('fornecedorRecape', m.fornecedorRecape || m.marcaRecape || '');

  // Mostrar campos corretos
  if (typeof toggleMovFields === 'function') toggleMovFields();

  movEmEdicao = id;
  if ($('btnSalvarMov')) $('btnSalvarMov').innerHTML = '💾 Atualizar Movimentação';
  document.querySelector('.tab-btn[data-target="tab-cadastro"]')?.click();
}

function excluirMovimentacao(id) {
  if (!confirm('Excluir esta movimentação permanentemente? (Isso não reverterá os efeitos no pneu)')) return;
  saveData(KEYS.MOVS, getData(KEYS.MOVS).filter(m => m.id !== id));
  renderHistoricoMov();
}

let conferenciaItensMotorista = [];

function initMotoristaApp(usuario) {
  if ($('driverUserName')) $('driverUserName').textContent = usuario.nome || usuario.usuario;
  if ($('dataMov') && !getVal('dataMov')) $('dataMov').value = new Date().toISOString().split('T')[0];
  if ($('numeroPneu')) $('numeroPneu').addEventListener('blur', () => preencherDadosAnteriores(getVal('numeroPneu')));
  ['lado', 'eixo', 'stepNumero'].forEach(id => { if ($(id)) $(id).addEventListener('change', atualizarLocal); });
  if ($('btnAdicionarConferenciaItem')) $('btnAdicionarConferenciaItem').addEventListener('click', adicionarItemConferenciaMotorista);
  if ($('btnSalvarMov')) $('btnSalvarMov').addEventListener('click', salvarConferenciaMotorista);
  popularSelectVeiculos(usuario.nome || usuario.usuario);
  if ($('veiculoAtual')) $('veiculoAtual').addEventListener('change', renderPneusEsperadosMotorista);
  if (typeof toggleDriverMovFields === 'function') toggleDriverMovFields();
  renderPneusEsperadosMotorista();
  renderItensConferenciaMotorista();
  renderHistoricoMotorista();
}

function pneusEsperadosDoVeiculo(placa) {
  return getData(KEYS.PNEUS)
    .filter(p => p.statusAtual === 'Rodando' && normalizarChave(p.veiculoAtual) === normalizarChave(placa))
    .sort((a, b) => normalizarPosicaoPneu(a.localAtual).localeCompare(normalizarPosicaoPneu(b.localAtual)));
}

function renderPneusEsperadosMotorista() {
  const box = $('driverExpectedTires');
  if (!box) return;
  const placa = getVal('veiculoAtual');
  if (!placa) {
    box.innerHTML = '<p class="driver-empty">Selecione o veiculo para ver os pneus esperados.</p>';
    return;
  }
  const pneus = pneusEsperadosDoVeiculo(placa);
  if (!pneus.length) {
    box.innerHTML = '<p class="driver-empty">Nenhum pneu rodando vinculado a este veiculo no sistema.</p>';
    return;
  }
  box.innerHTML = pneus.map(p => `
    <article class="driver-expected-item">
      <div>
        <strong>${escapeHtml(p.localAtual || 'Sem posicao')}</strong>
        <span>Fogo ${escapeHtml(p.numPneu)} - ${escapeHtml(p.marca || '-')}</span>
      </div>
      <div class="driver-expected-actions">
        <button type="button" onclick="selecionarPneuConferenciaMotorista('${escapeHtml(p.numPneu)}','Atualizacao')">Atualizar</button>
        <button type="button" onclick="selecionarPneuConferenciaMotorista('${escapeHtml(p.numPneu)}','Troca')">Trocar</button>
        <button type="button" onclick="selecionarPneuConferenciaMotorista('${escapeHtml(p.numPneu)}','Retirada')">Retirar</button>
      </div>
    </article>`).join('');
}

function preencherPosicaoConferencia(local) {
  const pos = normalizarPosicaoPneu(local);
  if (pos.startsWith('STEP')) {
    setSelectPorTexto('eixo', 'STEP');
    const n = pos.match(/\d+/)?.[0] || '1';
    setSelectPorTexto('stepNumero', `${n} Step`);
    setVal('lado', '');
  } else {
    const eixo = pos.match(/(\d+).*EIXO/)?.[1];
    const lado = ['LDD', 'LDF', 'LED', 'LEF', 'LD', 'LE'].find(cod => pos.endsWith(cod));
    if (eixo) setSelectPorTexto('eixo', `${eixo} EIXO`);
    if (lado) setSelectPorTexto('lado', lado);
  }
  toggleStepField();
  atualizarLocal();
}

function setSelectPorTexto(id, valor) {
  const el = $(id);
  if (!el) return;
  const alvo = normalizarPosicaoPneu(valor);
  const opt = [...el.options].find(option => {
    const texto = `${option.value} ${option.textContent}`;
    return normalizarPosicaoPneu(texto).includes(alvo) || alvo.includes(normalizarPosicaoPneu(option.value));
  });
  if (opt) el.value = opt.value;
}

function selecionarPneuConferenciaMotorista(numPneu, tipo) {
  const pneu = getData(KEYS.PNEUS).find(p => normalizarChave(p.numPneu) === normalizarChave(numPneu));
  if ($('tipoMov')) $('tipoMov').value = tipo;
  if (tipo === 'Troca') {
    setVal('pneuSaiu', numPneu);
    setVal('pneuEntrou', '');
  } else {
    setVal('numeroPneu', numPneu);
  }
  if (pneu) preencherPosicaoConferencia(pneu.localAtual);
  if (typeof toggleDriverMovFields === 'function') toggleDriverMovFields();
  notificar('Pneu carregado na conferencia.', 'success');
}

function itemConferenciaAtual() {
  const tipo = getVal('tipoMov');
  if (tipo === 'SemAlteracao') return null;

  const item = {
    id: gerarId(),
    tipo,
    numeroPneu: getVal('numeroPneu'),
    pneuSaiu: getVal('pneuSaiu'),
    pneuEntrou: getVal('pneuEntrou'),
    eixo: getVal('eixo'),
    lado: getVal('lado'),
    stepNumero: getVal('stepNumero'),
    localAtual: getVal('localAtual'),
    observacao: getVal('observacao')
  };

  if (tipo === 'Troca') {
    if (!item.pneuSaiu || !item.pneuEntrou) throw new Error('Informe o pneu que saiu e o pneu que entrou.');
  } else if (!item.numeroPneu) {
    throw new Error('Informe o NÂº de fogo do pneu.');
  }

  if (!item.localAtual) throw new Error('Informe eixo e lado para gerar a posicao.');
  return item;
}

function limparCamposItemConferencia() {
  ['numeroPneu', 'pneuSaiu', 'pneuEntrou', 'eixo', 'lado', 'stepNumero', 'localAtual'].forEach(id => setVal(id));
  if (typeof toggleStepField === 'function') toggleStepField();
}

function renderItensConferenciaMotorista() {
  const lista = $('conferenciaItensList');
  if (!lista) return;
  if (!conferenciaItensMotorista.length) {
    lista.innerHTML = '<p class="driver-empty">Nenhuma alteracao adicionada.</p>';
    return;
  }

  lista.innerHTML = conferenciaItensMotorista.map((item, index) => {
    const titulo = item.tipo === 'Troca'
      ? `Troca: ${escapeHtml(item.pneuSaiu)} -> ${escapeHtml(item.pneuEntrou)}`
      : `${escapeHtml(tipoMovimentacaoLabel(item.tipo))}: ${escapeHtml(item.numeroPneu)}`;
    return `<article class="driver-history-item">
      <strong>${titulo}</strong>
      <span>${escapeHtml(item.localAtual || '-')}</span>
      <button class="driver-mini-action" type="button" onclick="removerItemConferenciaMotorista(${index})">Remover</button>
    </article>`;
  }).join('');
}

function adicionarItemConferenciaMotorista() {
  try {
    const item = itemConferenciaAtual();
    if (!item) return;
    conferenciaItensMotorista.push(item);
    renderItensConferenciaMotorista();
    limparCamposItemConferencia();
    notificar('Alteracao adicionada na conferencia.', 'success');
  } catch (error) {
    notificar(error.message, 'error');
  }
}

function removerItemConferenciaMotorista(index) {
  conferenciaItensMotorista.splice(index, 1);
  renderItensConferenciaMotorista();
}

async function salvarConferenciaMotorista(event) {
  const botao = event?.currentTarget || $('btnSalvarMov');
  const tipo = getVal('tipoMov');
  const dataConferencia = getVal('dataMov');
  const veiculo = getVal('veiculoAtual');
  const kmVeiculo = Number(getVal('kmVeiculo')) || 0;

  if (!dataConferencia) return notificar('Informe a data da conferencia.', 'error');
  if (!veiculo) return notificar('Selecione o veiculo.', 'error');
  if (kmVeiculo <= 0) return notificar('Informe o KM atual do veiculo.', 'error');

  if (tipo !== 'SemAlteracao' && !conferenciaItensMotorista.length) {
    try {
      const item = itemConferenciaAtual();
      if (item) conferenciaItensMotorista.push(item);
    } catch (error) {
      return notificar(error.message, 'error');
    }
  }

  if (!setBotaoCarregando(botao, true, 'Enviando...')) return;
  try {
    await apiCriarConferencia({
      dataConferencia,
      veiculo,
      kmVeiculo,
      tipo,
      itens: tipo === 'SemAlteracao' ? [] : conferenciaItensMotorista,
      observacao: getVal('observacao')
    });
    notificar('Conferencia enviada para aprovacao.', 'success');
    conferenciaItensMotorista = [];
    renderItensConferenciaMotorista();
    ['numeroPneu', 'pneuSaiu', 'pneuEntrou', 'eixo', 'lado', 'stepNumero', 'localAtual', 'observacao'].forEach(id => setVal(id));
    if ($('tipoMov')) $('tipoMov').value = 'SemAlteracao';
    if ($('dataMov')) $('dataMov').value = new Date().toISOString().split('T')[0];
    if (typeof toggleDriverMovFields === 'function') toggleDriverMovFields();
    await renderHistoricoMotorista();
  } catch (error) {
    notificar(error.message || 'Erro ao enviar conferencia.', 'error');
  } finally {
    setBotaoCarregando(botao, false);
    if (botao) botao.textContent = 'Enviar conferencia';
  }
}

async function renderHistoricoMotorista() {
  const lista = $('driverHistoryList');
  if (!lista) return;
  lista.innerHTML = '<p class="driver-empty">Carregando conferencias...</p>';
  try {
    const conferencias = (await fetchConferencias()).slice(0, 5);
    if (!conferencias.length) {
      lista.innerHTML = '<p class="driver-empty">Nenhuma conferencia enviada ainda.</p>';
      return;
    }
    lista.innerHTML = conferencias.map(c => {
      const qtd = Array.isArray(c.itens) ? c.itens.length : 0;
      const statusClass = c.status === 'aprovado' ? 'badge-success' : c.status === 'recusado' ? 'badge-danger' : 'badge-warning';
      return `<article class="driver-history-item">
        <strong>${escapeHtml(c.veiculo || '-')} - ${kmFormatado(c.kmVeiculo)}</strong>
        <span>${formatarDataDashboard(c.dataConferencia)} - ${qtd ? `${qtd} alteracao(oes)` : 'sem alteracao'}</span>
        <small><span class="badge ${statusClass}">${escapeHtml(c.status || 'pendente')}</span></small>
      </article>`;
    }).join('');
  } catch (error) {
    lista.innerHTML = `<p class="driver-empty">${escapeHtml(error.message)}</p>`;
  }
}

function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function formatarDataDashboard(data) {
  const iso = dataIsoCurta(data);
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '-';
}

function diasDesdeDataDashboard(data) {
  const iso = dataIsoCurta(data);
  if (!iso) return null;
  const alvo = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoje - alvo) / 86400000));
}

function numeroPneuMovimentacao(mov) {
  return String(mov.id_pneu || mov.numeroPneu || '').trim();
}

function tipoMovimentacaoLabel(tipo) {
  const labels = {
    Instalacao: 'Instalação',
    Retirada: 'Retirada',
    Baixa: 'Baixa',
    Recapagem: 'Recapagem',
    Atualizacao: 'Atualização'
  };
  return labels[tipo] || tipo || '-';
}

function destinoMovimentacao(mov) {
  const tipo = mov.tipo_movimentacao || mov.tipoMov || '';
  if (tipo === 'Baixa') return 'Baixado';
  if (tipo === 'Retirada') return 'Estoque';
  return mov.veiculoAtual || mov.placa_veiculo || mov.localAtual || mov.posicao || '-';
}

function ordenarMovimentacoesRecentes(movs) {
  return movs.slice().sort((a, b) => {
    const dataA = obterDataMovimentacao(a);
    const dataB = obterDataMovimentacao(b);
    if (dataA !== dataB) return dataB.localeCompare(dataA);
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

function mapaUltimaMovimentacaoPorPneu(movs) {
  const mapa = new Map();
  ordenarMovimentacoesRecentes(movs).forEach(mov => {
    const pneu = numeroPneuMovimentacao(mov);
    if (pneu && !mapa.has(pneu)) mapa.set(pneu, mov);
  });
  return mapa;
}

function renderDashboardEmpty(container, texto) {
  if (container) container.innerHTML = `<div class="ops-empty">${escapeHtml(texto)}</div>`;
}

function localizacaoPneuDashboard(pneu) {
  const veiculo = pneu.veiculoAtual && pneu.veiculoAtual !== '-' ? pneu.veiculoAtual : 'Estoque';
  const local = veiculo === 'Estoque' ? 'Estoque' : (pneu.localAtual && pneu.localAtual !== '-' ? pneu.localAtual : 'Sem posicao');
  return { veiculo, local };
}

function renderDashboardOperacional() {
  const alertsEl = $('dashboardAlerts');
  const watchEl = $('dashboardWatchlist');
  const recentEl = $('dashboardRecentMoves');
  if (!alertsEl && !watchEl && !recentEl) return;

  const pneus = getData(KEYS.PNEUS);
  const movs = getData(KEYS.MOVS);
  const ativos = pneus.filter(p => p.statusAtual !== 'Baixado');
  const rodando = pneus.filter(p => p.statusAtual === 'Rodando');
  const estoque = pneus.filter(p => p.statusAtual === 'Estoque');
  const conferenciasPendentes = getData(KEYS.CONFERENCIAS).filter(c => c.status === 'pendente');
  const ultimaPorPneu = mapaUltimaMovimentacaoPorPneu(movs);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const pneusSemKm = ativos.filter(p => asNumber(p.kmRodadoTotal) <= 0);
  const pneusParados = rodando.filter(p => {
    const ultima = ultimaPorPneu.get(String(p.numPneu || '').trim());
    const dias = ultima ? diasDesdeDataDashboard(obterDataMovimentacao(ultima)) : null;
    return dias === null || dias >= 90;
  });
  const movsRecentes = movs.filter(m => {
    const dias = diasDesdeDataDashboard(obterDataMovimentacao(m));
    return dias !== null && dias <= 7;
  });
  const baixas30 = movs.filter(m => {
    const tipo = m.tipo_movimentacao || m.tipoMov || '';
    const dias = diasDesdeDataDashboard(obterDataMovimentacao(m));
    return tipo === 'Baixa' && dias !== null && dias <= 30;
  });

  const cpkValidos = ativos
    .map(p => ({ pneu: p, cpk: cpkPneu(p), km: asNumber(p.kmRodadoTotal), custo: custoTotalPneu(p) }))
    .filter(item => item.cpk !== null);
  const kmCpk = cpkValidos.reduce((a, item) => a + item.km, 0);
  const custoCpk = cpkValidos.reduce((a, item) => a + item.custo, 0);
  const cpkMedio = kmCpk > 0 ? custoCpk / kmCpk : 0;
  const cpkAltos = cpkValidos.filter(item => cpkMedio > 0 && item.cpk > cpkMedio * 1.25);
  const kmsAtivos = ativos.map(p => asNumber(p.kmRodadoTotal)).filter(km => km > 0);
  const kmMedioAtivos = kmsAtivos.length ? kmsAtivos.reduce((a, km) => a + km, 0) / kmsAtivos.length : 0;
  const prioridadesPneus = ativos.map(p => {
    const numPneu = String(p.numPneu || '').trim();
    const ultima = ultimaPorPneu.get(numPneu);
    const diasParado = ultima ? diasDesdeDataDashboard(obterDataMovimentacao(ultima)) : null;
    const cpk = cpkPneu(p);
    const kmTotalPneu = asNumber(p.kmRodadoTotal);
    const motivos = [];
    let prioridade = 0;
    let tipo = 'info';

    if (p.statusAtual === 'Rodando' && (diasParado === null || diasParado >= 90)) {
      prioridade += diasParado === null ? 24 : 36;
      if (tipo === 'info') tipo = 'warning';
      motivos.push(diasParado === null ? 'Rodando sem histórico recente' : `Sem movimentação há ${diasParado} dias`);
    }

    if (kmTotalPneu <= 0) {
      prioridade += 18;
      motivos.push('Sem KM calculado');
    }

    if (kmMedioAtivos > 0 && kmTotalPneu > kmMedioAtivos * 1.35) {
      prioridade += 18;
      motivos.push(`KM alto para acompanhar: ${kmFormatado(kmTotalPneu)}`);
    }

    if (cpk !== null && cpkMedio > 0 && cpk > cpkMedio * 1.25) {
      prioridade += 28;
      if (tipo === 'info') tipo = 'warning';
      motivos.push(`CPK acima da média: ${cpkFormatado(cpk)}`);
    }

    const localizacao = localizacaoPneuDashboard(p);
    return { pneu: p, prioridade, tipo, motivos, cpk, diasParado, kmTotalPneu, ...localizacao };
  }).filter(item => item.prioridade > 0)
    .sort((a, b) => b.prioridade - a.prioridade);

  const alertas = [];
  if (conferenciasPendentes.length) alertas.push({
    tipo: 'warning',
    titulo: `${conferenciasPendentes.length} conferencia(s) de motorista pendente(s)`,
    detalhe: 'Acesse Configuracoes para aprovar ou recusar antes de fechar os relatorios.'
  });
  if (pneusParados.length) alertas.push({
    tipo: 'warning',
    titulo: `${pneusParados.length} pneu(s) rodando sem movimentação recente`,
    detalhe: 'Revise veículos com pneus sem lançamento há 90 dias ou mais.'
  });
  if (pneus.length && estoque.length <= Math.max(2, Math.ceil(pneus.length * 0.05))) alertas.push({
    tipo: 'info',
    titulo: 'Estoque abaixo do ideal',
    detalhe: `${estoque.length} pneu(s) em estoque para ${pneus.length} cadastrados.`
  });
  if (pneusSemKm.length) alertas.push({
    tipo: 'info',
    titulo: `${pneusSemKm.length} pneu(s) sem KM calculado`,
    detalhe: 'Sem KM, o CPK fica incompleto e perde força na análise.'
  });
  if (cpkAltos.length) alertas.push({
    tipo: 'danger',
    titulo: `${cpkAltos.length} pneu(s) com CPK acima da média`,
    detalhe: 'Priorize estes pneus nos relatórios para entender custo por marca, veículo ou recapagem.'
  });
  if (baixas30.length) alertas.push({
    tipo: 'danger',
    titulo: `${baixas30.length} baixa(s) nos últimos 30 dias`,
    detalhe: 'Confira se há padrão por marca, veículo ou aplicação.'
  });
  if (!movsRecentes.length && pneus.length) alertas.push({
    tipo: 'warning',
    titulo: 'Sem movimentações nos últimos 7 dias',
    detalhe: 'Acompanhe se os lançamentos estão sendo feitos na rotina.'
  });

  const itensAlerta = [
    ...alertas.map(alerta => ({ ...alerta, geral: true })),
    ...prioridadesPneus.map(item => ({ ...item, geral: false }))
  ];

  if ($('dashboardAlertsCount')) $('dashboardAlertsCount').textContent = itensAlerta.length;
  if (alertsEl) {
    if (!itensAlerta.length) {
      alertsEl.innerHTML = '<div class="ops-alert ops-alert-success"><span class="ops-alert-dot"></span><div><strong>Operação sem alertas críticos</strong><small>Os principais indicadores estão dentro do esperado.</small></div></div>';
    } else {
      alertsEl.innerHTML = itensAlerta.slice(0, 8).map(item => {
        if (item.geral) {
          return `
            <div class="ops-alert ops-alert-${item.tipo}">
              <span class="ops-alert-dot"></span>
              <div>
                <strong>${escapeHtml(item.titulo)}</strong>
                <small>${escapeHtml(item.detalhe)}</small>
              </div>
            </div>
          `;
        }
        return `
          <div class="ops-alert priority-alert ops-alert-${item.tipo}">
            <span class="ops-alert-dot"></span>
            <div>
              <strong>Pneu ${escapeHtml(item.pneu.numPneu || '-')} <span class="priority-chip">${escapeHtml(item.pneu.statusAtual || '-')}</span></strong>
              <small><b>Veículo/implemento:</b> ${escapeHtml(item.veiculo)} · <b>Local:</b> ${escapeHtml(item.local)}</small>
              <small class="priority-reason">${escapeHtml(item.motivos.join(' | '))}</small>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  let score = pneus.length ? 100 : null;
  if (score !== null) {
    score -= Math.min(22, Math.round((pneusParados.length / Math.max(1, rodando.length)) * 35));
    score -= Math.min(14, Math.round((pneusSemKm.length / Math.max(1, ativos.length)) * 35));
    score -= Math.min(14, Math.round((cpkAltos.length / Math.max(1, ativos.length)) * 35));
    score -= Math.min(16, Math.round((baixas30.length / Math.max(1, pneus.length)) * 120));
    score = Math.max(35, Math.min(100, Math.round(score)));
  }
  const healthCard = $('dashboardHealthCard');
  if (healthCard) healthCard.classList.remove('health-good', 'health-warn', 'health-danger');
  let healthLabel = 'Sem dados suficientes';
  let healthClass = 'health-warn';
  if (score !== null) {
    if (score >= 82) { healthLabel = 'Controle forte'; healthClass = 'health-good'; }
    else if (score >= 62) { healthLabel = 'Atenção moderada'; healthClass = 'health-warn'; }
    else { healthLabel = 'Ação necessária'; healthClass = 'health-danger'; }
  }
  if (healthCard) healthCard.classList.add(healthClass);
  if ($('dashboardHealthScore')) $('dashboardHealthScore').textContent = score === null ? '--' : `${score}%`;
  if ($('dashboardHealthLabel')) $('dashboardHealthLabel').textContent = healthLabel;

  if (watchEl) {
    const candidatos = prioridadesPneus.slice(0, 6);
    if (!candidatos.length) {
      renderDashboardEmpty(watchEl, 'Nenhum pneu em atenção no momento.');
    } else {
      watchEl.innerHTML = candidatos.map(({ pneu, cpk, diasParado, kmTotalPneu, veiculo, local }) => {
        const detalhe = [
          pneu.marca || 'Marca nao informada',
          pneu.statusAtual || '-',
          veiculo || '-',
          local || '-'
        ].filter(Boolean).join(' - ');
        const metrica = kmFormatado(kmTotalPneu);
        const apoio = cpk !== null ? cpkFormatado(cpk) : (diasParado === null ? 'sem histórico' : `${diasParado} dias`);
        return `
          <div class="ops-row">
            <div>
              <strong>${escapeHtml(pneu.numPneu || '-')}</strong>
              <small>${escapeHtml(detalhe)}</small>
            </div>
            <div class="ops-metric">
              <strong>${escapeHtml(metrica)}</strong>
              <span>${escapeHtml(apoio)}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  if (recentEl) {
    const recentes = ordenarMovimentacoesRecentes(movs).slice(0, 6);
    if (!recentes.length) {
      renderDashboardEmpty(recentEl, 'Nenhuma movimentação registrada.');
    } else {
      recentEl.innerHTML = recentes.map(mov => {
        const tipo = mov.tipo_movimentacao || mov.tipoMov || '';
        return `
          <div class="ops-row ops-row-compact">
            <div>
              <strong>${escapeHtml(numeroPneuMovimentacao(mov) || '-')}</strong>
              <small>${escapeHtml(tipoMovimentacaoLabel(tipo))} em ${formatarDataDashboard(obterDataMovimentacao(mov))}</small>
            </div>
            <div class="ops-metric">
              <strong>${escapeHtml(destinoMovimentacao(mov))}</strong>
              <span>${kmMovimentacao(mov) > 0 ? `${kmMovimentacao(mov).toLocaleString('pt-BR')} km` : ''}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

/* === DASHBOARD === */
function atualizarDashboard() {
  const pneus = getData(KEYS.PNEUS), veiculos = getData(KEYS.VEICULOS);
  const recapagens = getData(KEYS.RECAPAGENS);
  const pneusComCpk = pneus.filter(p => cpkPneu(p) !== null);
  const cpkKm = pneusComCpk.reduce((a, p) => a + asNumber(p.kmRodadoTotal), 0);
  const cpkCusto = pneusComCpk.reduce((a, p) => a + custoTotalPneu(p), 0);
  const cpkMedio = cpkKm > 0 ? cpkCusto / cpkKm : 0;
  const kmTotal = pneus.reduce((a, p) => a + asNumber(p.kmRodadoTotal), 0);
  const investimentoTotal = pneus.reduce((a, p) => a + custoTotalPneu(p), 0);
  const totalRecapagens = recapagens.length || pneus.reduce((a, p) => a + quantidadeRecapagensPneu(p), 0);
  const s = {
    total: pneus.length, rodando: pneus.filter(p => p.statusAtual === 'Rodando').length,
    estoque: pneus.filter(p => p.statusAtual === 'Estoque').length,
    baixados: pneus.filter(p => p.statusAtual === 'Baixado').length, veiculos: veiculos.length
  };
  if ($('totalPneus')) $('totalPneus').textContent = s.total;
  if ($('totalRodando')) $('totalRodando').textContent = s.rodando;
  if ($('totalEstoque')) $('totalEstoque').textContent = s.estoque;
  if ($('totalBaixados')) $('totalBaixados').textContent = s.baixados;
  if ($('totalVeiculos')) $('totalVeiculos').textContent = s.veiculos;
  if ($('cpkMedioDashboard')) $('cpkMedioDashboard').textContent = cpkMedio ? cpkFormatado(cpkMedio) : 'R$\u00a00,00';
  if ($('kmRodadoDashboard')) $('kmRodadoDashboard').textContent = kmFormatado(kmTotal);
  if ($('investimentoDashboard')) $('investimentoDashboard').textContent = moeda(investimentoTotal);
  if ($('recapagensDashboard')) $('recapagensDashboard').textContent = totalRecapagens.toLocaleString('pt-BR');
  renderDashboardOperacional();
}

/* === GRÁFICOS (Chart.js) === */
function criarGraficoPizza(canvasId, titulo, labels, dados, cores) {
  const ctx = $(canvasId); if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInst) ctx._chartInst.destroy();
  ctx._chartInst = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: dados, backgroundColor: cores, borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 12, family: 'Inter' } } },
        title: { display: !!titulo, text: titulo, font: { size: 14, weight: 'bold', family: 'Inter' } }
      }
    }
  });
}

function criarGraficoBarra(canvasId, titulo, labels, dados, cor) {
  const ctx = $(canvasId); if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInst) ctx._chartInst.destroy();
  ctx._chartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels, datasets: [{
        label: titulo, data: dados, backgroundColor: cor || 'rgba(26,122,58,0.7)',
        borderColor: cor || '#1a7a3a', borderWidth: 1, borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Inter' } } },
        x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }
      },
      plugins: { legend: { display: false }, title: { display: !!titulo, text: titulo, font: { size: 14, weight: 'bold', family: 'Inter' } } }
    }
  });
}

function criarGraficoLinha(canvasId, titulo, labels, datasets) {
  const ctx = $(canvasId); if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInst) ctx._chartInst.destroy();
  ctx._chartInst = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } },
      plugins: {
        title: { display: !!titulo, text: titulo, font: { size: 14, weight: 'bold', family: 'Inter' } },
        legend: { labels: { font: { family: 'Inter' } } }
      },
      elements: { line: { tension: 0.4 }, point: { radius: 4, hoverRadius: 6 } }
    }
  });
}

function obterDataMovimentacao(mov) {
  const data = mov.dataMov || mov.data_movimentacao || mov.data || '';
  return typeof data === 'string' ? data.slice(0, 10) : dataIsoCurta(data);
}

function anosMovimentacoes(movs) {
  const anos = [...new Set(movs.map(obterDataMovimentacao)
    .filter(Boolean)
    .map(d => d.slice(0, 4))
    .filter(a => /^\d{4}$/.test(a)))]
    .sort((a, b) => Number(b) - Number(a));
  return anos.length ? anos : [String(new Date().getFullYear())];
}

function popularFiltroAnosMovimentacoes(movs) {
  const selectAno = $('dashMovAno');
  if (!selectAno) return;
  const anos = anosMovimentacoes(movs);
  const valorAtual = selectAno.value;
  selectAno.innerHTML = anos.map(ano => `<option value="${ano}">${ano}</option>`).join('');
  selectAno.value = anos.includes(valorAtual) ? valorAtual : anos[0];
}

function atualizarResumoMovimentacoes(labels, dados) {
  const total = dados.reduce((a, n) => a + n, 0);
  const media = dados.length ? total / dados.length : 0;
  const picoValor = Math.max(0, ...dados);
  const picoIndice = dados.indexOf(picoValor);
  if ($('dashMovTotal')) $('dashMovTotal').textContent = total.toLocaleString('pt-BR');
  if ($('dashMovMedia')) $('dashMovMedia').textContent = media.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if ($('dashMovPico')) $('dashMovPico').textContent = picoValor > 0 && picoIndice >= 0 ? `${labels[picoIndice]} (${picoValor})` : '-';
}

function renderGraficoMovimentacoesDashboard() {
  const canvas = $('graficoMovimentacoes');
  if (!canvas || typeof Chart === 'undefined') return;

  const movs = getData(KEYS.MOVS);
  popularFiltroAnosMovimentacoes(movs);

  const periodo = $('dashMovPeriodo')?.value || 'mensal';
  const ano = $('dashMovAno')?.value || anosMovimentacoes(movs)[0];
  const selectAno = $('dashMovAno');
  if (selectAno) selectAno.style.display = periodo === 'mensal' ? '' : 'none';

  let labels = [];
  let dados = [];

  if (periodo === 'anual') {
    labels = anosMovimentacoes(movs).sort((a, b) => Number(a) - Number(b));
    dados = labels.map(labelAno => movs.filter(m => obterDataMovimentacao(m).slice(0, 4) === labelAno).length);
  } else {
    const nomesMes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    labels = nomesMes;
    dados = Array.from({ length: 12 }, (_, idx) => movs.filter(m => {
      const d = obterDataMovimentacao(m);
      return d.slice(0, 4) === ano && Number(d.slice(5, 7)) === idx + 1;
    }).length);
  }

  atualizarResumoMovimentacoes(labels, dados);

  const media = dados.length ? dados.reduce((a, n) => a + n, 0) / dados.length : 0;
  if (canvas._chartInst) canvas._chartInst.destroy();
  canvas._chartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Movimentações',
          data: dados,
          backgroundColor: 'rgba(21, 115, 71, 0.78)',
          borderColor: '#157347',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: periodo === 'anual' ? 52 : 34
        },
        {
          type: 'line',
          label: 'Média',
          data: dados.map(() => +media.toFixed(2)),
          borderColor: '#c58a12',
          backgroundColor: 'rgba(197, 138, 18, 0.12)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#c58a12',
          tension: 0.32,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        y: { beginAtZero: true, grid: { color: '#eef2f7' }, ticks: { precision: 0, font: { family: 'Inter' } } },
        x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Inter' } } },
        title: { display: true, text: periodo === 'anual' ? 'Movimentações por Ano' : `Movimentações por Mês - ${ano}`, font: { size: 14, weight: 'bold', family: 'Inter' } }
      }
    }
  });
}

function initFiltrosMovimentacoesDashboard() {
  const periodo = $('dashMovPeriodo');
  const ano = $('dashMovAno');
  if (periodo && !periodo.dataset.bound) {
    periodo.addEventListener('change', renderGraficoMovimentacoesDashboard);
    periodo.dataset.bound = '1';
  }
  if (ano && !ano.dataset.bound) {
    ano.addEventListener('change', renderGraficoMovimentacoesDashboard);
    ano.dataset.bound = '1';
  }
}

function gerarGraficosDashboard() {
  if (typeof Chart === 'undefined') return;
  const pneus = getData(KEYS.PNEUS);
  const rodando = pneus.filter(p => p.statusAtual === 'Rodando').length;
  const estoque = pneus.filter(p => p.statusAtual === 'Estoque').length;
  const baixados = pneus.filter(p => p.statusAtual === 'Baixado').length;
  const recapados = pneus.filter(p => p.statusAtual === 'Recapado').length;
  criarGraficoPizza('graficoStatus', 'Distribuição por Status',
    ['Rodando', 'Estoque', 'Baixados', 'Recapados'], [rodando, estoque, baixados, recapados],
    ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6']);
  // Gráfico por marca
  const marcas = {}; pneus.forEach(p => { const marca = p.marca || 'Marca nao informada'; marcas[marca] = (marcas[marca] || 0) + 1; });
  const marcasOrdenadas = Object.entries(marcas).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const mLabels = marcasOrdenadas.map(([marca]) => marca), mData = marcasOrdenadas.map(([, total]) => total);
  criarGraficoBarra('graficoMarcas', 'Pneus por Marca', mLabels, mData, 'rgba(26,122,58,0.75)');
  const cpkMarcas = {};
  pneus.forEach(p => {
    const km = asNumber(p.kmRodadoTotal);
    const custo = custoTotalPneu(p);
    if (km <= 0 || custo <= 0) return;
    const marca = p.marca || 'Marca nao informada';
    if (!cpkMarcas[marca]) cpkMarcas[marca] = { custo: 0, km: 0 };
    cpkMarcas[marca].custo += custo;
    cpkMarcas[marca].km += km;
  });
  const rankingCpk = Object.entries(cpkMarcas)
    .map(([marca, s]) => ({ marca, cpk: s.custo / s.km }))
    .sort((a, b) => a.cpk - b.cpk)
    .slice(0, 10);
  criarGraficoBarra('graficoCpkMarca', 'Melhor CPK por Marca', rankingCpk.map(r => r.marca), rankingCpk.map(r => +r.cpk.toFixed(4)), 'rgba(37,99,235,0.75)');
  initFiltrosMovimentacoesDashboard();
  renderGraficoMovimentacoesDashboard();
}

/* === RELATÓRIOS === */
function gerarRelatorios() {
  if (typeof Chart === 'undefined') return;
  const pneus = getData(KEYS.PNEUS), movs = getData(KEYS.MOVS);
  // Ranking de marcas
  const marcas = {}; pneus.forEach(p => {
    if (!marcas[p.marca]) marcas[p.marca] = { qtd: 0, totalKm: 0, qtdBaixados: 0, totalValor: 0 };
    marcas[p.marca].qtd++; marcas[p.marca].totalValor += p.valorCompra || 0;
    if (p.statusAtual === 'Baixado' && p.kmRodadoTotal > 0) { marcas[p.marca].totalKm += p.kmRodadoTotal; marcas[p.marca].qtdBaixados++; }
  });
  const ranking = Object.entries(marcas).map(([marca, s]) => ({ marca, mediaKm: s.qtdBaixados > 0 ? Math.round(s.totalKm / s.qtdBaixados) : 0, qtd: s.qtd }))
    .sort((a, b) => b.mediaKm - a.mediaKm);
  const tbody = $('rankingMarcas');
  if (tbody) {
    tbody.innerHTML = '';
    if (!ranking.length) tbody.innerHTML = '<tr><td colspan="3" class="text-center">Sem dados.</td></tr>';
    else ranking.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}º</td><td><strong>${r.marca}</strong></td><td>${r.mediaKm > 0 ? r.mediaKm.toLocaleString('pt-BR') + ' km' : 'N/A'}</td><td>${r.qtd}</td>`;
      tbody.appendChild(tr);
    });
  }
  // Stats do relatório
  const baixados = pneus.filter(p => p.statusAtual === 'Baixado' && p.kmRodadoTotal > 0);
  const mediaGeral = baixados.length ? Math.round(baixados.reduce((a, p) => a + p.kmRodadoTotal, 0) / baixados.length) : 0;
  if ($('mediaGeralKm')) $('mediaGeralKm').textContent = mediaGeral.toLocaleString('pt-BR') + ' km';
  if ($('totalGastoGeral')) $('totalGastoGeral').textContent = moeda(pneus.reduce((a, p) => a + (p.valorCompra || 0), 0));
  if ($('totalMovimentacoes')) $('totalMovimentacoes').textContent = movs.length;
  // Gráfico pizza do relatório
  const tipos = {}; pneus.forEach(p => { tipos[p.tipo || 'Sem tipo'] = (tipos[p.tipo || 'Sem tipo'] || 0) + 1; });
  criarGraficoPizza('graficoTipos', 'Pneus por Tipo', Object.keys(tipos), Object.values(tipos),
    ['#1a7a3a', '#d4a017', '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b']);
  // Gráfico custo por marca
  const custoMarcas = Object.entries(marcas).map(([m, s]) => ({ marca: m, custo: s.totalValor })).sort((a, b) => b.custo - a.custo);
  criarGraficoBarra('graficoCustoMarca', 'Investimento por Marca',
    custoMarcas.map(c => c.marca), custoMarcas.map(c => c.custo), 'rgba(212,160,23,0.75)');
}

/* === CONFIGURACOES E ACESSOS === */
function perfilLabelSistema(perfil) {
  const mapa = {
    admin: 'Administrador',
    administrador: 'Administrador',
    adm: 'Administrador',
    assistente: 'Assistente',
    operacional: 'Assistente',
    motorista: 'Motorista'
  };
  return mapa[String(perfil || '').toLowerCase()] || 'Assistente';
}

function usuarioPodeGerenciarConferencias(usuario) {
  return perfilUsuarioNormalizado(usuario?.perfil) !== 'motorista';
}

function initConfiguracoes(usuario) {
  renderMeuAcesso(usuario);
  document.querySelectorAll('.admin-settings-only').forEach(secao => {
    secao.style.display = usuarioEhAdmin(usuario) ? '' : 'none';
  });
  document.querySelectorAll('.staff-settings-only').forEach(secao => {
    secao.style.display = usuarioPodeGerenciarConferencias(usuario) ? '' : 'none';
  });

  if (usuarioEhAdmin(usuario)) {
    renderSolicitacoesAcesso();
    renderUsuariosAcesso(usuario);
  } else {
    listarUsuariosAcesso()
      .then(usuarios => renderMeuAcesso(usuarios[0] || usuario))
      .catch(() => renderMeuAcesso(usuario));
  }

  if (usuarioPodeGerenciarConferencias(usuario)) renderConferenciasMotoristas();
}

async function listarUsuariosAcesso(status = '') {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return await apiUsuarios(query);
}

async function atualizarStatusAcesso(id, status) {
  return await apiUsuarios(`/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
}

async function atualizarPermissoesAcesso(id, podeCadastrar, podeRelatorios) {
  return await apiUsuarios(`/${encodeURIComponent(id)}/permissoes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ podeCadastrar, podeRelatorios })
  });
}

async function atualizarPerfilAcesso(id, perfil) {
  return await apiUsuarios(`/${encodeURIComponent(id)}/perfil`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ perfil })
  });
}

async function atualizarMeuAcessoApi(payload) {
  return await apiUsuarios('/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function permissaoLabel(valor, texto) {
  return `<span class="permission-pill ${valor ? 'allowed' : 'blocked'}">${texto}: ${valor ? 'Liberado' : 'Bloqueado'}</span>`;
}

function renderMeuAcesso(usuario) {
  const box = $('resumoMeuAcesso');
  preencherFormularioMeuAcesso(usuario);
  if (!box) return;

  box.innerHTML = `
    <div class="permission-profile">
      <div>
        <span class="cell-sub">Usuario</span>
        <strong>${escapeHtml(usuario.nome || usuario.usuario || '-')}</strong>
      </div>
      <div>
        <span class="cell-sub">Funcao</span>
        <strong>${escapeHtml(perfilLabelSistema(usuario.perfil))}</strong>
      </div>
      <div>
        <span class="cell-sub">Permissoes</span>
        <div class="permission-pills">
          ${permissaoLabel(usuarioPodeCadastrar(usuario), 'Cadastros')}
          ${permissaoLabel(usuarioPodeRelatorios(usuario), 'Relatorios')}
        </div>
      </div>
    </div>
  `;
}

function preencherFormularioMeuAcesso(usuario) {
  if (!usuario) return;
  setVal('meuNome', usuario.nome || '');
  setVal('meuUsuario', usuario.usuario || '');
}

async function salvarMeuAcesso() {
  const nome = getVal('meuNome');
  const usuario = getVal('meuUsuario').toLowerCase();
  const senhaAtual = getVal('minhaSenhaAtual');
  const novaSenha = getVal('minhaNovaSenha');
  const confirmarSenha = getVal('confirmarNovaSenha');
  const botao = $('btnSalvarMeuAcesso');

  if (!nome || !usuario) {
    notificar('Informe nome e usuario.', 'error');
    return;
  }

  if (novaSenha || confirmarSenha) {
    if (!senhaAtual) {
      notificar('Informe a senha atual para trocar a senha.', 'error');
      return;
    }
    if (novaSenha.length < 4) {
      notificar('A nova senha precisa ter pelo menos 4 caracteres.', 'error');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      notificar('A confirmacao da nova senha nao confere.', 'error');
      return;
    }
  }

  if (!setBotaoCarregando(botao, true, 'Salvando...')) return;
  try {
    const data = await atualizarMeuAcessoApi({ nome, usuario, senhaAtual, novaSenha });
    const usuarioAtualizado = salvarSessaoUsuario(data.usuario, data.token);
    atualizarUsuarioNaInterface(usuarioAtualizado);
    renderMeuAcesso(usuarioAtualizado);
    ['minhaSenhaAtual', 'minhaNovaSenha', 'confirmarNovaSenha'].forEach(id => setVal(id));
    notificar('Seus dados foram atualizados.', 'success');
  } catch (error) {
    notificar(error.message, 'error');
  } finally {
    setBotaoCarregando(botao, false);
  }
}

async function renderSolicitacoesAcesso() {
  const tbody = $('tabelaSolicitacoesAcesso');
  const contador = $('totalSolicitacoesPendentes');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" class="text-center">Carregando solicitacoes...</td></tr>';

  try {
    const solicitacoes = (await listarUsuariosAcesso('pendente'))
      .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));

    if (contador) contador.textContent = solicitacoes.length;
    tbody.innerHTML = '';

    if (!solicitacoes.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma solicitacao pendente.</td></tr>';
      return;
    }

    solicitacoes.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(s.nome || '-')}</strong><small class="cell-sub">${escapeHtml(s.usuario || '-')}</small></td>
        <td><span class="badge badge-info">${escapeHtml(perfilLabelSistema(s.perfil))}</span></td>
        <td>${formatarDataDashboard(s.criadoEm)}</td>
        <td><span class="badge badge-warning">Pendente</span></td>
        <td class="table-actions">
          <button class="btn btn-primary btn-sm" onclick="aprovarSolicitacaoAcesso(${Number(s.id)})">Aprovar</button>
          <button class="btn btn-secondary btn-sm" onclick="recusarSolicitacaoAcesso(${Number(s.id)})">Recusar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    if (contador) contador.textContent = '0';
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function renderUsuariosAcesso(usuarioLogado = obterUsuarioLogado()) {
  const tbody = $('tabelaUsuariosAcesso');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando usuarios...</td></tr>';

  try {
    const usuarios = (await listarUsuariosAcesso('aprovado,bloqueado'))
      .sort((a, b) => String(a.nome || a.usuario || '').localeCompare(String(b.nome || b.usuario || ''), 'pt-BR'));

    tbody.innerHTML = '';
    if (!usuarios.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum usuario aprovado.</td></tr>';
      return;
    }

    usuarios.forEach(u => {
      const ativo = (u.status || 'aprovado') === 'aprovado' && u.ativo !== false;
      const isAtual = normalizarChave(u.usuario) === normalizarChave(usuarioLogado?.usuario);
      const perfilAtual = perfilUsuarioNormalizado(u.perfil);
      const podeCadastrar = u.podeCadastrar !== false;
      const podeRelatorios = u.podeRelatorios !== false;
      const botoesPerfil = ['admin', 'assistente', 'motorista'].map(perfil => {
        const atual = perfilAtual === perfil;
        const desabilitado = atual || (isAtual && perfil !== 'admin');
        return `<button class="permission-toggle ${atual ? 'allowed' : 'blocked'}" ${desabilitado ? 'disabled' : ''} onclick="alterarPerfilUsuarioAcesso(${Number(u.id)}, '${perfil}')">${perfilLabelSistema(perfil)}</button>`;
      }).join('');
      const permissoes = perfilAtual === 'admin'
        ? '<span class="permission-pill allowed">Acesso total de administrador</span>'
        : perfilAtual === 'motorista'
          ? '<span class="permission-pill blocked">Acesso apenas do motorista</span>'
          : `
            <button class="permission-toggle ${podeCadastrar ? 'allowed' : 'blocked'}" onclick="alternarPermissaoUsuarioAcesso(${Number(u.id)}, ${!podeCadastrar}, ${podeRelatorios})">Cadastros</button>
            <button class="permission-toggle ${podeRelatorios ? 'allowed' : 'blocked'}" onclick="alternarPermissaoUsuarioAcesso(${Number(u.id)}, ${podeCadastrar}, ${!podeRelatorios})">Relatorios</button>
          `;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(u.nome || '-')}</strong><small class="cell-sub">${escapeHtml(u.usuario || '-')}</small></td>
        <td>
          <span class="badge badge-info">${escapeHtml(perfilLabelSistema(u.perfil))}</span>
          <div class="permission-actions role-actions">${botoesPerfil}</div>
        </td>
        <td>
          <div class="permission-actions">
            ${permissoes}
          </div>
        </td>
        <td>${formatarDataDashboard(u.aprovadoEm || u.criadoEm)}</td>
        <td><span class="badge ${ativo ? 'badge-success' : 'badge-danger'}">${ativo ? 'Ativo' : 'Bloqueado'}</span></td>
        <td class="table-actions">
          <button class="btn btn-secondary btn-sm" ${isAtual ? 'disabled' : ''} onclick="alternarStatusUsuarioAcesso(${Number(u.id)}, '${ativo ? 'aprovado' : 'bloqueado'}')">${ativo ? 'Bloquear' : 'Ativar'}</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function alterarPerfilUsuarioAcesso(id, perfil) {
  try {
    await atualizarPerfilAcesso(id, perfil);
    notificar(`Usuario definido como ${perfilLabelSistema(perfil)}.`, 'success');
    await renderUsuariosAcesso();
  } catch (error) {
    notificar(error.message, 'error');
  }
}

function resumoItensConferencia(conferencia) {
  const itens = Array.isArray(conferencia.itens) ? conferencia.itens : [];
  if (!itens.length) return 'Sem alteracao';
  return itens.map(item => {
    if (item.tipo === 'Troca') return `Troca ${item.pneuSaiu || '-'} -> ${item.pneuEntrou || '-'} (${item.localAtual || '-'})`;
    return `${tipoMovimentacaoLabel(item.tipo)} ${item.numeroPneu || '-'} (${item.localAtual || '-'})`;
  }).join('<br>');
}

async function renderConferenciasMotoristas() {
  const tbody = $('tabelaConferenciasMotoristas');
  const contador = $('totalConferenciasPendentes');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando conferencias...</td></tr>';
  try {
    const conferencias = await fetchConferencias('pendente');
    if (contador) contador.textContent = conferencias.length;
    tbody.innerHTML = '';

    if (!conferencias.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma conferencia pendente.</td></tr>';
      return;
    }

    conferencias.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(c.motoristaNome || '-')}</strong><small class="cell-sub">${escapeHtml(c.motoristaUsuario || '-')}</small></td>
        <td><strong>${escapeHtml(c.veiculo || '-')}</strong><small class="cell-sub">${escapeHtml(kmFormatado(c.kmVeiculo))}</small></td>
        <td>${formatarDataDashboard(c.dataConferencia)}</td>
        <td>${resumoItensConferencia(c)}</td>
        <td><span class="badge badge-warning">Pendente</span></td>
        <td class="table-actions">
          <button class="btn btn-primary btn-sm" onclick="aprovarConferenciaMotorista(${Number(c.id)})">Aprovar</button>
          <button class="btn btn-secondary btn-sm" onclick="recusarConferenciaMotorista(${Number(c.id)})">Recusar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    if (contador) contador.textContent = '0';
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">${escapeHtml(error.message)}</td></tr>`;
  }
}

function movimentosDaConferencia(conferencia) {
  const itens = Array.isArray(conferencia.itens) ? conferencia.itens : [];
  const dataMov = conferencia.dataConferencia;
  const veiculo = conferencia.veiculo;
  const km = asNumber(conferencia.kmVeiculo);

  const base = {
    data_movimentacao: dataMov,
    dataMov,
    veiculoAtual: veiculo,
    placa_veiculo: veiculo,
    km_entrada: 0,
    km_saida: 0,
    observacao: `Conferencia motorista #${conferencia.id}${conferencia.observacao ? ` - ${conferencia.observacao}` : ''}`
  };

  const movimentos = [];
  itens.forEach(item => {
    const local = item.localAtual || '';
    if (item.tipo === 'Troca') {
      if (item.pneuSaiu) {
        movimentos.push({
          ...base,
          id: gerarId(),
          numeroPneu: item.pneuSaiu,
          id_pneu: item.pneuSaiu,
          tipo_movimentacao: 'Retirada',
          tipoMov: 'Retirada',
          veiculoAnterior: veiculo,
          localAnterior: local,
          veiculoAtual: '',
          placa_veiculo: '',
          localAtual: 'Estoque',
          posicao: 'Estoque',
          km_saida: km
        });
      }
      if (item.pneuEntrou) {
        movimentos.push({
          ...base,
          id: gerarId(),
          numeroPneu: item.pneuEntrou,
          id_pneu: item.pneuEntrou,
          tipo_movimentacao: 'Instalacao',
          tipoMov: 'Instalacao',
          veiculoAnterior: 'Estoque',
          localAnterior: 'Estoque',
          localAtual: local,
          posicao: local,
          km_entrada: km
        });
      }
      return;
    }

    const numeroPneu = item.numeroPneu || item.pneuEntrou || item.pneuSaiu || '';
    if (!numeroPneu) return;

    const tipoMov = item.tipo === 'Baixa' ? 'Baixa' :
      item.tipo === 'Retirada' ? 'Retirada' :
        item.tipo === 'Atualizacao' ? 'Atualizacao' : 'Instalacao';

    movimentos.push({
      ...base,
      id: gerarId(),
      numeroPneu,
      id_pneu: numeroPneu,
      tipo_movimentacao: tipoMov,
      tipoMov,
      veiculoAnterior: ['Retirada', 'Baixa'].includes(tipoMov) ? veiculo : 'Estoque',
      localAnterior: ['Retirada', 'Baixa'].includes(tipoMov) ? local : 'Estoque',
      veiculoAtual: ['Retirada', 'Baixa'].includes(tipoMov) ? '' : veiculo,
      placa_veiculo: ['Retirada', 'Baixa'].includes(tipoMov) ? '' : veiculo,
      localAtual: tipoMov === 'Baixa' ? '-' : (tipoMov === 'Retirada' ? 'Estoque' : local),
      posicao: tipoMov === 'Baixa' ? '-' : (tipoMov === 'Retirada' ? 'Estoque' : local),
      km_entrada: tipoMov === 'Instalacao' ? km : 0,
      km_saida: ['Retirada', 'Atualizacao', 'Baixa'].includes(tipoMov) ? km : 0
    });
  });

  return movimentos;
}

async function aprovarConferenciaMotorista(id) {
  const conferencia = getData(KEYS.CONFERENCIAS).find(c => Number(c.id) === Number(id));
  if (!conferencia) return notificar('Conferencia nao encontrada.', 'error');
  if (!confirm('Aprovar esta conferencia e gerar as movimentacoes oficiais?')) return;

  try {
    const movimentos = movimentosDaConferencia(conferencia);
    for (const mov of movimentos) {
      await apiSalvarMovimentacao(mov);
    }
    await apiAtualizarStatusConferencia(id, 'aprovado');
    await sincronizarDadosBanco(['pneus', 'movimentacoes']);
    notificar(movimentos.length ? 'Conferencia aprovada e movimentacoes geradas.' : 'Conferencia sem alteracao aprovada.', 'success');
    await renderConferenciasMotoristas();
  } catch (error) {
    notificar(error.message || 'Erro ao aprovar conferencia.', 'error');
  }
}

async function recusarConferenciaMotorista(id) {
  const motivo = prompt('Motivo da recusa ou ajuste solicitado:') || '';
  try {
    await apiAtualizarStatusConferencia(id, 'recusado', motivo);
    notificar('Conferencia recusada.', 'success');
    await renderConferenciasMotoristas();
  } catch (error) {
    notificar(error.message || 'Erro ao recusar conferencia.', 'error');
  }
}

async function aprovarSolicitacaoAcesso(id) {
  try {
    await atualizarStatusAcesso(id, 'aprovado');
    notificar('Acesso aprovado com sucesso.', 'success');
    await renderSolicitacoesAcesso();
    await renderUsuariosAcesso();
  } catch (error) {
    notificar(error.message, 'error');
  }
}

async function recusarSolicitacaoAcesso(id) {
  try {
    await atualizarStatusAcesso(id, 'recusado');
    notificar('Solicitacao recusada.', 'success');
    await renderSolicitacoesAcesso();
  } catch (error) {
    notificar(error.message, 'error');
  }
}

async function alternarStatusUsuarioAcesso(id, statusAtual) {
  try {
    const novoStatus = statusAtual === 'aprovado' ? 'bloqueado' : 'aprovado';
    await atualizarStatusAcesso(id, novoStatus);
    notificar(novoStatus === 'aprovado' ? 'Usuario ativado.' : 'Usuario bloqueado.', 'success');
    await renderUsuariosAcesso();
  } catch (error) {
    notificar(error.message, 'error');
  }
}

async function alternarPermissaoUsuarioAcesso(id, podeCadastrar, podeRelatorios) {
  try {
    await atualizarPermissoesAcesso(id, podeCadastrar, podeRelatorios);
    notificar('Permissoes atualizadas.', 'success');
    await renderUsuariosAcesso();
  } catch (error) {
    notificar(error.message, 'error');
  }
}

/* === LIMPAR DADOS === */
function limparTodosDados() {
  if (confirm('ATENÇÃO! Isso apagará TODOS os dados. Continuar?')) {
    localStorage.removeItem(KEYS.PNEUS); localStorage.removeItem(KEYS.MOVS); localStorage.removeItem(KEYS.VEICULOS);
    alert('Dados limpos!'); location.reload();
  }
}

/* === INIT GLOBAL === */
document.addEventListener('DOMContentLoaded', async () => {
  const usuarioLogado = exigirLogin();
  if (!usuarioLogado) return;
  if (!exigirPerfil(usuarioLogado)) return;
  atualizarUsuarioNaInterface(usuarioLogado);

  const recursosPorPagina = {
    'dashboard-page': ['pneus', 'movimentacoes', 'veiculos'],
    'motoristas-page': ['motoristas'],
    'veiculos-page': ['veiculos', 'motoristas', 'pneus'],
    'pneus-page': ['pneus', 'movimentacoes'],
    'movimentacao-page': ['pneus', 'movimentacoes', 'veiculos'],
    'relatorios-page': ['pneus', 'movimentacoes', 'veiculos', 'motoristas'],
    'motorista-app-page': ['pneus', 'movimentacoes', 'veiculos'],
    'configuracoes-page': []
  };
  window.dadosBancoProntos = sincronizarDadosBanco(recursosPorPagina[document.body.id]);
  await window.dadosBancoProntos;
  if (document.body.id === 'dashboard-page' && usuarioPodeGerenciarConferencias(usuarioLogado)) {
    await fetchConferencias('pendente').catch(() => []);
  }

  // Motoristas
  if ($('motoristas-page')) initMotoristas();
  // Veículos
  if ($('veiculos-page')) initVeiculos();
  // Cadastro de pneu (página antiga, ainda suportada)
  if ($('cadastro-pneu-page')) initCadastroPneu();
  // Página unificada de pneus (cadastro + lista)
  if ($('pneus-page')) initPneus();
  // Movimentação
  if ($('movimentacao-page')) initMovimentacao();
  // Dashboard
  if ($('dashboard-page')) { atualizarDashboard(); gerarGraficosDashboard(); }
  // Relatórios
  if ($('relatorios-page')) gerarRelatorios();
  // Area do motorista
  if ($('motorista-app-page')) initMotoristaApp(usuarioLogado);
  // Configuracoes
  if ($('configuracoes-page')) initConfiguracoes(usuarioLogado);
});
