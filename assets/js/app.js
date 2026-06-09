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
  ACERTOS: 'acertos_viagem',
  MANUTENCOES: 'manutencoes_revisoes',
  DESPESAS: 'despesas_operacionais',
  LANCAMENTOS_ACERTO: 'lancamentos_acerto_viagem',
  SOLICITACOES_OPERACIONAIS: 'solicitacoes_operacionais',
  USER: 'usuarioLogado',
  USERS: 'usuariosSistema',
  ACCESS_REQUESTS: 'solicitacoesAcessoSistema'
};
const API_URL = window.EXECUTIVA_API_URL || (
  ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`
);
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

let sessaoApiEncerrada = false;

function respostaExigeLogout(res, data = {}) {
  if (res.status === 401) return true;
  if (res.status !== 403) return false;
  return /sessao|login|bloque|recusad|aguardando|nao esta ativo/i.test(String(data.error || data.message || ''));
}

function encerrarSessaoApi(mensagem = 'Sessao expirada. Faca login novamente.') {
  if (sessaoApiEncerrada) return;
  sessaoApiEncerrada = true;
  sessionStorage.removeItem(KEYS.USER);
  sessionStorage.removeItem('authToken');
  localStorage.removeItem(KEYS.USER);

  if (!/login\.html$/i.test(window.location.pathname)) {
    try { notificar(mensagem, 'error'); } catch {}
    window.setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
  }
}

async function fetchSeguro(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401 || res.status === 403) {
    const data = await res.clone().json().catch(() => ({}));
    if (respostaExigeLogout(res, data)) encerrarSessaoApi(data.error || data.message);
  }
  return res;
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

function normalizarTipoVeiculo(valor) {
  const tipo = String(valor || '').trim();
  const mapa = {
    '0': 'Cavalo',
    '1': 'Cavalo',
    '2': 'Carreta',
    '3': 'Reboque',
    '4': 'Bitrem',
    '5': 'Vanderleia',
    '6': 'Truck'
  };
  return mapa[tipo] || tipo || 'Cavalo';
}

function normalizarVeiculo(v) {
  return {
    ...v,
    id: String(v.id || v.placa || gerarId()),
    placa: String(v.placa || '').trim(),
    marca: String(v.marca || ''),
    modelo: String(v.modelo || ''),
    tipo: normalizarTipoVeiculo(v.tipo),
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
    const res = await fetchSeguro(`${API_URL}/${resource}`, {
      headers: authHeaders()
    });
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
    const res = await fetchSeguro(`${API_URL}/motoristas`, {
      headers: authHeaders()
    });
    if (!res.ok) throw new Error('Erro ao buscar motoristas');
    return await res.json();
  } catch (e) {
    console.error(e);
    return getData(KEYS.MOTORISTAS);
  }
}

async function apiSalvarMotorista(motorista) {
  const res = await fetchSeguro(`${API_URL}/motoristas`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(motorista)
  });
  if (!res.ok) throw new Error('Erro ao salvar motorista');
  return await res.json();
}

async function apiAtualizarMotorista(cpf, motorista) {
  const res = await fetchSeguro(`${API_URL}/motoristas/${cpf}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(motorista)
  });
  if (!res.ok) throw new Error('Erro ao atualizar motorista');
  return await res.json();
}

async function apiExcluirMotorista(cpf) {
  const res = await fetchSeguro(`${API_URL}/motoristas/${cpf}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!res.ok) throw new Error('Erro ao excluir motorista');
  return true;
}

async function apiSalvarVeiculo(veiculo) {
  const res = await fetchSeguro(`${API_URL}/veiculos`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(veiculo)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao salvar veiculo no banco');
  return data;
}

async function apiAtualizarVeiculo(id, veiculo) {
  const res = await fetchSeguro(`${API_URL}/veiculos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(veiculo)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao atualizar veiculo no banco');
  return data;
}

async function apiExcluirVeiculo(id) {
  const res = await fetchSeguro(`${API_URL}/veiculos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao excluir veiculo no banco');
  return true;
}

async function apiSalvarPneu(pneu) {
  const res = await fetchSeguro(`${API_URL}/pneus`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(pneu)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao salvar pneu no banco');
  return data;
}

async function apiSalvarMovimentacao(movimentacao) {
  const res = await fetchSeguro(`${API_URL}/movimentacoes`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(movimentacao)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao salvar movimentacao no banco');
  return data;
}

async function apiAtualizarMovimentacao(id, movimentacao) {
  const res = await fetchSeguro(`${API_URL}/movimentacoes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(movimentacao)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao atualizar movimentacao no banco');
  return data;
}

async function apiExcluirMovimentacao(id) {
  const res = await fetchSeguro(`${API_URL}/movimentacoes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao apagar movimentacao no banco');
  return data;
}

async function fetchConferencias(status = '') {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetchSeguro(`${API_URL}/conferencias${query}`, {
    headers: authHeaders()
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data.error || 'Erro ao buscar conferencias');
  if (Array.isArray(data)) saveData(KEYS.CONFERENCIAS, data);
  return Array.isArray(data) ? data : [];
}

async function apiCriarConferencia(conferencia) {
  const res = await fetchSeguro(`${API_URL}/conferencias`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(conferencia)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao enviar conferencia');
  return data;
}

async function apiAtualizarStatusConferencia(id, status, motivo = '') {
  const res = await fetchSeguro(`${API_URL}/conferencias/${encodeURIComponent(id)}/status`, {
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

function normalizarPlaca(valor) {
  return normalizarChave(valor).replace(/[^A-Z0-9]/g, '');
}

function placaCadastrada(valor) {
  const chave = normalizarPlaca(valor);
  if (!chave) return '';
  const veiculo = getData(KEYS.VEICULOS).find(item => normalizarPlaca(item.placa) === chave);
  return veiculo?.placa || '';
}

function placaExisteCadastro(valor) {
  return !!placaCadastrada(valor);
}

function motoristaCadastrado(valor) {
  const chave = normalizarChave(valor);
  if (!chave) return '';
  const motorista = getData(KEYS.MOTORISTAS).find(item => normalizarChave(item.nome) === chave);
  return motorista?.nome || '';
}

function motoristaExisteCadastro(valor) {
  return !!motoristaCadastrado(valor);
}

function validarNumeroFaixa(valor, minimo, maximo, nomeCampo, obrigatorio = false) {
  const bruto = String(valor ?? '').trim();
  if (!bruto && !obrigatorio) return null;
  if (!bruto && obrigatorio) return `${nomeCampo} é obrigatório.`;
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

  const chave = normalizarChave(pneu.numPneu);
  if (chave && pneus.some(p => normalizarChave(p.numPneu) === chave)) {
    erros.push('Este Nº de Fogo já está cadastrado.');
  }

  if (pneu.dataCompra && new Date(`${pneu.dataCompra}T00:00:00`) > new Date()) {
    erros.push('A data da compra não pode ser futura.');
  }

  [
    validarNumeroFaixa(getVal('valorCompra'), 0, 1000000, 'Valor de compra', true),
    validarNumeroFaixa(getVal('kmCompra'), 0, 5000000, 'KM na compra', true)
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

  const placaMov = normalizarChave(mov.veiculoAtual);
  if (mov.veiculoAtual && !['ESTOQUE', '-'].includes(placaMov) && !placaExisteCadastro(mov.veiculoAtual)) {
    atualizarEstadoCampoPesquisavel($('veiculoAtual'));
    erros.push(`A placa ${mov.veiculoAtual} nao existe no cadastro de veiculos.`);
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

function iconeLucide(nome, fallback = '') {
  const seguro = escapeHtml(String(nome || 'circle'));
  const textoFallback = escapeHtml(String(fallback || '').slice(0, 3));
  return `<i data-lucide="${seguro}" aria-hidden="true"></i>${textoFallback ? `<span class="nav-fallback">${textoFallback}</span>` : ''}`;
}

function ativarIconesInterface() {
  if (!document.querySelector('[data-lucide]')) return;

  const aplicar = () => {
    if (!window.lucide?.createIcons) return;
    window.lucide.createIcons({
      attrs: {
        'stroke-width': 2.1,
        'aria-hidden': 'true'
      }
    });
    document.documentElement.classList.add('lucide-loaded');
  };

  if (window.lucide?.createIcons) {
    aplicar();
    return;
  }

  if (document.getElementById('lucideIconLibrary')) return;
  const script = document.createElement('script');
  script.id = 'lucideIconLibrary';
  script.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
  script.defer = true;
  script.onload = aplicar;
  document.head.appendChild(script);
}

function prepararIdentidadeSidebar() {
  document.querySelectorAll('.sidebar-header').forEach(header => {
    header.innerHTML = `
      <div class="brand-lockup">
        <img class="brand-logo" src="../assets/img/executiva-logo.svg" alt="Executiva Agronegócios">
        <div class="brand-copy">
          <h2>EXECUTIVA</h2>
          <small>AGRONEGÓCIOS</small>
        </div>
      </div>
      <button class="sidebar-collapse" type="button" aria-label="Recolher menu">${iconeLucide('chevron-left', '<')}</button>
      <div class="sidebar-search">
        ${iconeLucide('search', 'PS')}
        <input type="search" placeholder="Pesquisar" aria-label="Pesquisar no menu">
      </div>
    `;
  });
}

function prepararTopoSistema(usuario) {
  const existente = document.querySelector('.app-topbar');
  if (document.body.classList.contains('driver-body')) {
    if (existente) existente.remove();
    return;
  }

  const perfil = perfilLabelSistema(usuario.perfil);
  const nome = escapeHtml(usuario.nome || usuario.usuario || 'Usuário');
  const subtitulo = perfil ? `<span>${escapeHtml(perfil)}</span>` : '';
  const html = `
    <div class="topbar-welcome">
      <strong>Boas vindas, ${nome}</strong>
      ${subtitulo}
    </div>
    <div class="topbar-company">
      <small>Selecione a corporação</small>
      <button type="button">Executiva Agronegócios ${iconeLucide('chevron-down', 'v')}</button>
    </div>
    <div class="topbar-actions" aria-label="Ações do sistema">
      <button type="button" title="Modo escuro">${iconeLucide('moon', 'MO')}</button>
      <button type="button" title="Suporte">${iconeLucide('headphones', 'SP')}</button>
      <button type="button" title="Notificações">${iconeLucide('bell', 'NT')}</button>
      <span class="topbar-avatar">${escapeHtml(String(usuario.nome || usuario.usuario || 'U').trim().charAt(0).toUpperCase() || 'U')}</span>
    </div>
  `;

  if (existente) {
    existente.innerHTML = html;
  } else {
    const topbar = document.createElement('header');
    topbar.className = 'app-topbar';
    topbar.innerHTML = html;
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.insertAdjacentElement('afterend', topbar);
    else document.body.prepend(topbar);
  }
}

function acaoNovoRegistro() {
  const abaCadastro = document.querySelector('.tab-btn[data-target="tab-cadastro"]');
  if (abaCadastro) {
    abaCadastro.click();
    return;
  }
  const primeiroForm = document.querySelector('form, .form-control');
  if (primeiroForm?.scrollIntoView) primeiroForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function acaoAbrirAba(target) {
  const aba = document.querySelector(`.tab-btn[data-target="${target}"]`);
  if (aba) aba.click();
}

function origemFiltrosPagina() {
  const movido = document.querySelector('.filter-drawer-fields[data-filter-drawer-source="1"]');
  if (movido) return movido;
  const seletores = {
    'veiculos-page': '#tab-lista .filtros-row',
    'motoristas-page': '#tab-lista .filtros-row',
    'pneus-page': '#tab-lista .filtros-row',
    'movimentacao-page': '.movement-filter-grid',
    'acerto-viagem-page': '.legacy-filter-grid',
    'relatorios-page': '.report-filter-card, .filtro-inline'
  };
  const seletor = seletores[document.body.id] || '.filtros-row, .movement-filter-grid, .legacy-filter-grid';
  return document.querySelector(seletor);
}

function tituloFiltrosPagina() {
  const titulos = {
    'veiculos-page': 'Filtrar veiculos',
    'motoristas-page': 'Filtrar motoristas',
    'pneus-page': 'Filtrar pneus',
    'movimentacao-page': 'Filtrar movimentacoes',
    'acerto-viagem-page': 'Filtrar viagens',
    'relatorios-page': 'Filtrar relatorio'
  };
  return titulos[document.body.id] || 'Filtrar';
}

function garantirGavetaFiltros() {
  let overlay = document.querySelector('.filter-drawer-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.className = 'filter-drawer-overlay';
  overlay.innerHTML = `
    <div class="filter-drawer-backdrop" onclick="fecharGavetaFiltros()"></div>
    <aside class="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="filterDrawerTitle">
      <header class="filter-drawer-header">
        <div>${iconeLucide('list-filter', '')}<strong id="filterDrawerTitle">Filtrar</strong></div>
        <button type="button" class="filter-drawer-close" onclick="fecharGavetaFiltros()" aria-label="Fechar">${iconeLucide('x', 'X')}</button>
      </header>
      <div class="filter-drawer-body" id="filterDrawerBody"></div>
      <footer class="filter-drawer-footer">
        <button type="button" class="btn btn-secondary" onclick="limparFiltrosPagina()">Limpar campos</button>
        <button type="button" class="btn btn-primary" onclick="aplicarFiltrosPagina()">Filtrar ${iconeLucide('chevron-right', '>')}</button>
      </footer>
    </aside>
  `;
  document.body.appendChild(overlay);
  ativarIconesInterface();
  return overlay;
}

function prepararFonteFiltrosParaGaveta(origem) {
  if (!origem) return null;
  if (!origem.dataset.filterDrawerSource) {
    origem.dataset.filterDrawerSource = '1';
    origem.__filterOriginalParent = origem.parentElement;
    origem.__filterOriginalNext = origem.nextElementSibling;
  }
  origem.classList.add('filter-drawer-fields');
  return origem;
}

function abrirGavetaFiltros() {
  const origem = origemFiltrosPagina();
  if (!origem) {
    const filtro = document.querySelector('#buscaVeiculo, #buscaPneu, #buscaMovimentacao, input[type="search"], input[placeholder*="Buscar"]');
    if (filtro?.focus) filtro.focus();
    return;
  }

  if (document.body.id === 'veiculos-page') acaoAbrirAba('tab-lista');
  if (document.body.id === 'pneus-page') acaoAbrirAba('tab-lista');
  const overlay = garantirGavetaFiltros();
  const body = $('filterDrawerBody');
  const titulo = $('filterDrawerTitle');
  if (titulo) titulo.textContent = tituloFiltrosPagina();
  if (body) body.appendChild(prepararFonteFiltrosParaGaveta(origem));
  overlay.classList.add('is-open');
  document.body.classList.add('filter-drawer-open');
  setTimeout(() => {
    const primeiro = body?.querySelector('input:not([type="hidden"]), select, textarea');
    if (primeiro?.focus) primeiro.focus();
  }, 80);
}

function fecharGavetaFiltros() {
  document.querySelector('.filter-drawer-overlay')?.classList.remove('is-open');
  document.body.classList.remove('filter-drawer-open');
}

function executarRenderFiltrosPagina() {
  const renderizadores = {
    'veiculos-page': () => { acaoAbrirAba('tab-lista'); renderVeiculos(); },
    'motoristas-page': () => renderMotoristas(),
    'pneus-page': () => { acaoAbrirAba('tab-lista'); renderPneus(); },
    'movimentacao-page': () => renderHistoricoMov(),
    'acerto-viagem-page': () => renderTabelaAcertosViagem(MODULOS_OPERACIONAIS['acerto-viagem-page'])
  };
  const executar = renderizadores[document.body.id];
  if (executar) executar();
}

function aplicarFiltrosPagina() {
  executarRenderFiltrosPagina();
  fecharGavetaFiltros();
}

function limparFiltrosPagina() {
  const origem = origemFiltrosPagina() || $('filterDrawerBody');
  if (!origem) return;
  origem.querySelectorAll('input, select, textarea').forEach(campo => {
    if (campo.type === 'checkbox' || campo.type === 'radio') campo.checked = false;
    else campo.value = '';
    campo.classList.remove('is-invalid');
    campo.dispatchEvent(new Event(campo.type === 'checkbox' || campo.type === 'radio' ? 'change' : 'input', { bubbles: true }));
  });

  if ($('filtroAcertoTodas')) $('filtroAcertoTodas').checked = true;
  if ($('filtroAcertoStatusTodas')) $('filtroAcertoStatusTodas').checked = true;
  const movTodos = document.querySelector('input[name="filtroMovSituacao"][value=""]');
  if (movTodos) movTodos.checked = true;
  executarRenderFiltrosPagina();
}

function acaoFiltrarPagina() {
  abrirGavetaFiltros();
}

function prepararAcoesPagina() {
  if (document.body.classList.contains('driver-body')) return;
  const header = document.querySelector('.main-content .page-header');
  if (!header || document.querySelector('.page-actions-toolbar')) return;
  const acoesPorPagina = {
    'motoristas-page': [
      { label: 'Buscar', icon: 'list-filter', action: 'acaoFiltrarPagina()' },
      { label: 'Atualizar', icon: 'refresh-cw', action: 'location.reload()' },
      { label: 'Novo motorista', icon: 'user-plus', action: 'acaoNovoRegistro()' }
    ],
    'veiculos-page': [
      { label: 'Filtrar', icon: 'list-filter', action: 'acaoFiltrarPagina()' },
      { label: 'Atualizar', icon: 'refresh-cw', action: 'location.reload()' },
      { label: 'Novo veiculo', icon: 'plus', action: 'acaoNovoRegistro()' }
    ],
    'pneus-page': [
      { label: 'Filtrar', icon: 'list-filter', action: 'acaoFiltrarPagina()' },
      { label: 'Novo pneu', icon: 'plus', action: "acaoAbrirAba('tab-cadastro')" },
      { label: 'Atualizar', icon: 'refresh-cw', action: 'location.reload()' }
    ],
    'movimentacao-page': [
      { label: 'Filtrar', icon: 'list-filter', action: 'acaoFiltrarPagina()' },
      { label: 'Atualizar', icon: 'refresh-cw', action: 'location.reload()' },
      { label: 'Nova movimentacao', icon: 'repeat-2', action: 'acaoNovoRegistro()' }
    ],
    'acerto-viagem-page': [
      { label: 'Filtrar', icon: 'list-filter', action: 'acaoFiltrarPagina()' },
      { label: 'Novo acerto', icon: 'plus', href: 'acerto-viagem-detalhe.html' },
      { label: 'Atualizar', icon: 'refresh-cw', action: 'location.reload()' }
    ],
    'acerto-viagem-detalhe-page': [
      { label: 'Consulta', icon: 'list-filter', href: 'acerto-viagem.html' },
      { label: 'Novo acerto', icon: 'plus', action: 'novoAcertoViagem()' },
      { label: 'Salvar', icon: 'save', action: "document.getElementById('formAcertoViagem')?.requestSubmit()" },
      { label: 'Lancamento', icon: 'receipt', action: "abrirGavetaLancamentoAcerto('Despesa')" }
    ],
    'despesas-page': [
      { label: 'Pendentes', icon: 'inbox', action: "document.getElementById('tabelaDespesas')?.scrollIntoView({behavior:'smooth',block:'start'})" },
      { label: 'Abrir acerto', icon: 'route', href: 'acerto-viagem.html' },
      { label: 'Atualizar', icon: 'refresh-cw', action: 'location.reload()' }
    ],
    'solicitacoes-page': [
      { label: 'Pendentes', icon: 'clipboard-list', action: "document.getElementById('tabelaSolicitacoes')?.scrollIntoView({behavior:'smooth',block:'start'})" },
      { label: 'Abrir acerto', icon: 'route', href: 'acerto-viagem.html' },
      { label: 'Atualizar', icon: 'refresh-cw', action: 'location.reload()' }
    ],
    'manutencao-page': [
      { label: 'Nova OS', icon: 'wrench', action: 'acaoNovoRegistro()' },
      { label: 'Atualizar', icon: 'refresh-cw', action: 'location.reload()' }
    ],
    'relatorios-page': [
      { label: 'Atualizar', icon: 'refresh-cw', action: 'location.reload()' }
    ],
    'financeiro-page': [
      { label: 'DRE financeiro', icon: 'line-chart', action: "document.querySelector('.finance-hero-panel')?.scrollIntoView({behavior:'smooth',block:'start'})" },
      { label: 'Acertos', icon: 'route', href: 'acerto-viagem.html' },
      { label: 'Atualizar', icon: 'refresh-cw', action: 'location.reload()' }
    ]
  };
  const acoes = acoesPorPagina[document.body.id] || [];
  if (!acoes.length) return;
  const toolbar = document.createElement('div');
  toolbar.className = 'page-actions-toolbar';
  toolbar.innerHTML = acoes.map(acao => {
    const conteudo = `${iconeLucide(acao.icon, '')}<span>${escapeHtml(acao.label)}</span>`;
    if (acao.href) return `<a class="toolbar-button" href="${escapeHtml(acao.href)}">${conteudo}</a>`;
    return `<button type="button" onclick="${escapeHtml(acao.action)}">${conteudo}</button>`;
  }).join('');
  header.insertAdjacentElement('afterend', toolbar);
}

function alternarGrupoMenu(botao, event) {
  if (event) event.stopPropagation();
  const secao = botao?.closest('.nav-section');
  if (!secao) return;
  const abrir = !secao.classList.contains('is-open');
  document.querySelectorAll('.sidebar-nav .nav-section.is-open').forEach(item => {
    if (item !== secao) item.classList.remove('is-open');
  });
  secao.classList.toggle('is-open', abrir);
  botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
}

function atualizarUsuarioNaInterface(usuario) {
  if (!usuario) return;
  const perfil = perfilUsuarioNormalizado(usuario.perfil);
  const usarShellPadrao = !document.body.classList.contains('driver-body');
  document.body.classList.remove('erp-ribbon-layout');
  document.body.classList.toggle('emitai-shell-layout', usarShellPadrao);
  document.body.classList.toggle('motorista-layout', perfil === 'motorista');
  prepararIdentidadeSidebar();
  prepararMenuAdministrativo(usuario);
  prepararTopoSistema(usuario);
  prepararAcoesPagina();
  document.querySelectorAll('.sidebar-footer').forEach(footer => {
    let info = footer.querySelector('.sidebar-user');
    if (!info) {
      info = document.createElement('div');
      info.className = 'sidebar-user';
      footer.prepend(info);
    }
    info.className = 'sidebar-user';
    info.innerHTML = `<span>${perfilLabelSistema(usuario.perfil)}</span><strong>${usuario.nome || usuario.usuario}</strong>`;

    const botaoSair = footer.querySelector('.btn-sair');
    if (botaoSair) botaoSair.innerHTML = `${iconeLucide('log-out', 'SA')}<span>Sair</span>`;
  });
  ativarIconesInterface();
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
  const paginasAreaMotorista = ['motorista-app-page'];

  if (perfil === 'motorista') {
    if (paginasAreaMotorista.includes(document.body.id)) return true;
    window.location.href = 'motorista-app.html';
    return false;
  }

  if (document.body.id === 'configuracoes-page') return true;
  if (paginaAtualEhMotorista()) {
    window.location.href = 'dashboard.html';
    return false;
  }

  if (['relatorios-page', 'financeiro-page'].includes(document.body.id) && !usuarioPodeRelatorios(usuario)) {
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

  const paginaAtual = (window.location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
  const hashAtual = (window.location.hash || '').toLowerCase();
  const itemMenuAtivo = item => {
    const [hrefBase, hrefHash] = String(item.href || '').toLowerCase().split('#');
    if (paginaAtual === 'acerto-viagem-detalhe.html' && hrefBase === 'acerto-viagem.html') return true;
    if (paginaAtual !== hrefBase) return false;
    if (hrefHash) return hashAtual === `#${hrefHash}`;
    return !hashAtual;
  };
  const perfil = perfilUsuarioNormalizado(usuario?.perfil || 'assistente');
  const itensAreaMotorista = [
    { href: 'motorista-app.html', icon: 'clipboard-check', fallback: 'CF', text: 'Área do motorista' }
  ];
  const gruposAdmin = [
    {
      titulo: 'Home',
      icon: 'home',
      fallback: 'IN',
      href: 'dashboard.html'
    },
    {
      titulo: 'Frota',
      icon: 'truck',
      fallback: 'FR',
      itens: [
        { href: 'motoristas.html', icon: 'users', fallback: 'MO', text: 'Motoristas', permission: usuarioPodeCadastrar(usuario) },
        { href: 'veiculos.html', icon: 'truck', fallback: 'VE', text: 'Veiculos', permission: usuarioPodeCadastrar(usuario) }
      ]
    },
    {
      titulo: 'Pneus',
      icon: 'circle-dot',
      fallback: 'PN',
      itens: [
        { href: 'pneus.html', icon: 'gauge', fallback: 'PN', text: 'Setor de pneus', permission: usuarioPodeCadastrar(usuario) },
        { href: 'movimentacao.html', icon: 'repeat-2', fallback: 'MV', text: 'Movimentações' },
        { href: 'relatorios.html', icon: 'bar-chart-3', fallback: 'RL', text: 'Relatórios de pneus', permission: usuarioPodeRelatorios(usuario) }
      ]
    },
    {
      titulo: 'Manutenção',
      icon: 'wrench',
      fallback: 'MN',
      itens: [
        { href: 'manutencao.html', icon: 'wrench', fallback: 'MN', text: 'Ordens e revisões' },
        { href: 'solicitacoes.html', icon: 'clipboard-list', fallback: 'SL', text: 'Solicitações' }
      ]
    },
    {
      titulo: 'Viagens',
      icon: 'route',
      fallback: 'VG',
      itens: [
        { href: 'acerto-viagem.html', icon: 'route', fallback: 'AC', text: 'Acerto viagem' },
        { href: 'despesas.html', icon: 'inbox', fallback: 'LX', text: 'Lançamentos do acerto' },
        { href: 'solicitacoes.html', icon: 'clipboard-list', fallback: 'SL', text: 'Solicitações dos motoristas' },
        { href: 'financeiro.html', icon: 'landmark', fallback: 'DR', text: 'DRE viagens', permission: usuarioPodeRelatorios(usuario) }
      ]
    },
    {
      titulo: 'Financeiro',
      icon: 'landmark',
      fallback: 'FI',
      itens: [
        { href: 'financeiro.html', icon: 'line-chart', fallback: 'DR', text: 'DRE financeiro', permission: usuarioPodeRelatorios(usuario) }
      ]
    },
    {
      titulo: 'Relatórios',
      icon: 'bar-chart-3',
      fallback: 'RL',
      itens: [
        { href: 'relatorios.html', icon: 'line-chart', fallback: 'RL', text: 'Relatórios', permission: usuarioPodeRelatorios(usuario) }
      ]
    },
    {
      titulo: 'Sistema',
      icon: 'shield-check',
      fallback: 'ST',
      itens: [
        { href: 'configuracoes.html', icon: 'settings', fallback: 'CF', text: 'Configuracoes' }
      ]
    }
  ];
  const gruposMotorista = [
    {
      titulo: 'Área do Motorista',
      icon: 'user-check',
      fallback: 'AM',
      itens: itensAreaMotorista
    }
  ];
  const grupos = perfil === 'motorista' ? gruposMotorista : gruposAdmin;

  nav.innerHTML = grupos
    .filter(grupo => grupo.permission !== false)
    .map(grupo => {
      const itens = (grupo.itens || []).filter(item => item.permission !== false);
      const grupoAtivo = grupo.href ? itemMenuAtivo(grupo) : itens.some(itemMenuAtivo);
      if (grupo.href) {
        return `
          <div class="nav-section nav-direct ${grupoAtivo ? 'is-active' : ''}">
            <a href="${grupo.href}" class="nav-section-toggle ${grupoAtivo ? 'active' : ''}">
              <span class="nav-group-icon">${iconeLucide(grupo.icon || 'circle', grupo.fallback || 'MN')}</span>
              <span>${grupo.titulo}</span>
            </a>
          </div>`;
      }
      if (!itens.length) return '';
      return `
        <div class="nav-section ${grupoAtivo ? 'is-active is-open' : ''}">
          <button class="nav-section-toggle" type="button" onclick="alternarGrupoMenu(this, event)" aria-expanded="${grupoAtivo ? 'true' : 'false'}">
            <span class="nav-group-icon">${iconeLucide(grupo.icon || 'menu', grupo.fallback || 'MN')}</span>
            <span>${grupo.titulo}</span>
            <span class="nav-caret">${iconeLucide('chevron-right', '>')}</span>
          </button>
          <div class="nav-section-links" data-title="${escapeHtml(grupo.titulo)}">
          ${itens.map(item => `
            <a href="${item.href}" class="${itemMenuAtivo(item) ? 'active' : ''}">
              <span class="nav-icon">${iconeLucide(item.icon || 'circle', item.fallback || item.icon)}</span>
              <span class="nav-text">${item.text}</span>
            </a>
          `).join('')}
          </div>
        </div>`;
    })
    .join('');
  if (!window.menuSetoresClickBound) {
    document.addEventListener('click', event => {
      if (event.target.closest?.('.sidebar-nav')) return;
      document.querySelectorAll('.sidebar-nav .nav-section.is-open').forEach(secao => {
        secao.classList.remove('is-open');
        secao.querySelector('.nav-section-toggle')?.setAttribute('aria-expanded', 'false');
      });
    });
    window.menuSetoresClickBound = true;
  }
  ativarIconesInterface();
}

/* === USUARIOS DO SISTEMA === */
let usuarioSistemaEmEdicao = null;

async function apiUsuarios(path = '', options = {}) {
  const headers = authHeaders(options.headers || {});
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetchSeguro(`${API_URL}/usuarios${path}`, {
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
  ['buscaVeiculo', 'filtroVeiculoPlaca', 'filtroVeiculoMarca', 'filtroVeiculoModelo',
    'filtroVeiculoTipo', 'filtroVeiculoAno', 'filtroVeiculoMotorista'].forEach(id => {
      const campo = $(id);
      if (!campo) return;
      campo.addEventListener(campo.tagName === 'SELECT' ? 'change' : 'input', renderVeiculos);
    });
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

function salvarVeiculoLocal() {
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

function normalizarTipoFiltroVeiculo(valor) {
  const texto = normalizarTextoCatalogo(valor).replace(/[^A-Z0-9]/g, '');
  if (texto.includes('VANDERL')) return 'VANDERLEIA';
  if (texto.includes('TRUCK')) return 'TRUCK';
  return texto;
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
  const busca = normalizarTextoCatalogo(getVal('buscaVeiculo'));
  const placa = normalizarPlaca(getVal('filtroVeiculoPlaca'));
  const marca = normalizarTextoCatalogo(getVal('filtroVeiculoMarca'));
  const modelo = normalizarTextoCatalogo(getVal('filtroVeiculoModelo'));
  const tipo = normalizarTipoFiltroVeiculo(getVal('filtroVeiculoTipo'));
  const ano = String(getVal('filtroVeiculoAno') || '').trim();
  const motorista = normalizarTextoCatalogo(getVal('filtroVeiculoMotorista'));
  const filtrados = veiculos.filter(v => {
    const textoGeral = normalizarTextoCatalogo([v.placa, v.marca, v.modelo, v.tipo, v.ano, v.motorista].filter(Boolean).join(' '));
    return (!busca || textoGeral.includes(busca)) &&
      (!placa || normalizarPlaca(v.placa).includes(placa)) &&
      (!marca || normalizarTextoCatalogo(v.marca).includes(marca)) &&
      (!modelo || normalizarTextoCatalogo(v.modelo).includes(modelo)) &&
      (!tipo || normalizarTipoFiltroVeiculo(v.tipo) === tipo) &&
      (!ano || String(v.ano || '').includes(ano)) &&
      (!motorista || normalizarTextoCatalogo(v.motorista).includes(motorista));
  });
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
    tr.innerHTML = `<td colspan="7" class="text-center">Mostrando ${exibidos.length} de ${filtrados.length}. Use os filtros para localizar um registro especifico.</td>`;
    tbody.appendChild(tr);
  }
}

function excluirVeiculoLocal(id) {
  if (!confirm('Excluir este veículo?')) return;
  saveData(KEYS.VEICULOS, getData(KEYS.VEICULOS).filter(v => v.id !== id));
  renderVeiculos();
}

async function salvarVeiculo() {
  const placa = getVal('veiculoPlaca').toUpperCase();
  const marca = getVal('veiculoMarca');
  const modelo = getVal('veiculoModelo');
  const tipo = getVal('veiculoTipo');
  const ano = getVal('veiculoAno');
  const motorista = getVal('veiculoMotorista');

  if (!placa || !marca || !modelo || !tipo) {
    alert('Preencha Placa, Marca, Modelo e Tipo.');
    return;
  }

  const botao = $('btnSalvarVeiculo');
  if (!setBotaoCarregando(botao, true, veiculoEmEdicao ? 'Atualizando...' : 'Salvando...')) return;

  try {
    const veiculos = getData(KEYS.VEICULOS);

    if (veiculoEmEdicao) {
      const idx = veiculos.findIndex(v => v.id === veiculoEmEdicao);
      if (idx < 0) throw new Error('Veiculo nao encontrado para edicao.');
      if (veiculos.some(v => v.id !== veiculoEmEdicao && normalizarChave(v.placa) === normalizarChave(placa))) {
        throw new Error('Veiculo com esta placa ja existe.');
      }

      const placaAnterior = veiculos[idx].placa;
      const veiculoAtualizado = normalizarVeiculo(await apiAtualizarVeiculo(veiculoEmEdicao, { placa, marca, modelo, tipo, ano, motorista }));
      veiculos[idx] = { ...veiculos[idx], ...veiculoAtualizado, dataAtualizacao: new Date().toLocaleDateString('pt-BR') };
      if (placaAnterior && placaAnterior !== placa) atualizarPlacaRelacionada(placaAnterior, placa);
      saveData(KEYS.VEICULOS, veiculos);
      notificar('Veiculo atualizado com sucesso.', 'success');
    } else {
      if (veiculos.some(v => normalizarChave(v.placa) === normalizarChave(placa))) {
        throw new Error('Veiculo com esta placa ja existe.');
      }

      const veiculoCriado = normalizarVeiculo(await apiSalvarVeiculo({ placa, marca, modelo, tipo, ano, motorista }));
      veiculos.push({ ...veiculoCriado, dataCadastro: veiculoCriado.dataCadastro || new Date().toLocaleDateString('pt-BR') });
      saveData(KEYS.VEICULOS, veiculos);
      notificar('Veiculo cadastrado com sucesso.', 'success');
    }

    limparFormularioVeiculo();
    await sincronizarDadosBanco(['veiculos']).catch(() => {});
    renderVeiculos();
    document.querySelector('.tab-btn[data-target="tab-lista"]')?.click();
  } catch (error) {
    notificar(error.message || 'Erro ao salvar veiculo.', 'error');
  } finally {
    setBotaoCarregando(botao, false);
  }
}

async function excluirVeiculo(id) {
  if (!confirm('Excluir este veiculo?')) return;
  try {
    await apiExcluirVeiculo(id);
    saveData(KEYS.VEICULOS, getData(KEYS.VEICULOS).filter(v => v.id !== id));
    await sincronizarDadosBanco(['veiculos']).catch(() => {});
    renderVeiculos();
    notificar('Veiculo excluido com sucesso.', 'success');
  } catch (error) {
    notificar(error.message || 'Erro ao excluir veiculo.', 'error');
  }
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
        <div class="rodas-row rodas-top">${eixo.top.map(pos => renderRodaPneu(pos, pneuPorPosicao(eixo.nome, pos.codigo, pos.nomeLocal), 'top')).join('')}</div>
        <div class="eixo-label">${eixo.nome}</div>
        <div class="rodas-row rodas-bottom">${eixo.bottom.map(pos => renderRodaPneu(pos, pneuPorPosicao(eixo.nome, pos.codigo, pos.nomeLocal), 'bottom')).join('')}</div>
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
        <td>${escapeHtml(rotuloPosicaoPneu(item.local || '-'))}</td>
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
  const posicaoLegada = posicaoLegadaParaTexto(valor);
  return String(posicaoLegada || valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/º/g, '')
    .replace(/º/g, '')
    .replace(/[º°]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function posicaoLegadaParaTexto(valor) {
  const numero = Number(String(valor || '').trim());
  if (!Number.isInteger(numero)) return '';

  if (numero === 1) return '1º Eixo - LE';
  if (numero === 2) return '1º Eixo - LD';
  if (numero === 35) return 'STEP - 1';
  if (numero === 36) return 'STEP - 2';

  const grupos = [
    { inicio: 3, eixo: 2 },
    { inicio: 7, eixo: 3 },
    { inicio: 11, eixo: 4 },
    { inicio: 15, eixo: 5 },
    { inicio: 19, eixo: 6 },
    { inicio: 23, eixo: 7 },
    { inicio: 27, eixo: 8 },
    { inicio: 31, eixo: 9 }
  ];
  const grupo = grupos.find(g => numero >= g.inicio && numero <= g.inicio + 3);
  if (!grupo) return '';

  const lado = ['LEF', 'LED', 'LDD', 'LDF'][numero - grupo.inicio];
  return `${grupo.eixo}º Eixo - ${lado}`;
}

function rotuloLadoPneu(codigo) {
  const mapa = {
    LD: 'lado direito',
    LE: 'lado esquerdo',
    LDD: 'direito interno',
    LDF: 'direito externo',
    LED: 'esquerdo interno',
    LEF: 'esquerdo externo'
  };
  return mapa[String(codigo || '').toUpperCase()] || codigo || '-';
}

function rotuloPosicaoPneu(valor) {
  const bruto = String(valor ?? '').trim();
  if (!bruto || bruto === '-') return 'Sem posicao';
  const pos = normalizarPosicaoPneu(bruto);
  if (!pos) return bruto;
  if (pos === 'ESTOQUE') return 'Estoque';
  if (pos.startsWith('STEP')) {
    const numeroStep = pos.match(/\d+/)?.[0] || '';
    return numeroStep ? `Step ${numeroStep}` : 'Step';
  }
  const eixo = pos.match(/(\d+).*EIXO/)?.[1];
  const lado = ['LDD', 'LDF', 'LED', 'LEF', 'LD', 'LE'].find(codigo => pos.endsWith(codigo));
  if (eixo && lado) return `${eixo}o eixo - ${rotuloLadoPneu(lado)}`;
  return bruto;
}

function ordemPosicaoPneu(valor) {
  const bruto = String(valor ?? '').trim();
  const numeroLegado = Number(bruto);
  if (Number.isInteger(numeroLegado) && numeroLegado > 0) return numeroLegado;
  const pos = normalizarPosicaoPneu(bruto);
  if (pos.startsWith('STEP')) return 900 + (Number(pos.match(/\d+/)?.[0]) || 1);
  const eixo = Number(pos.match(/(\d+).*EIXO/)?.[1]) || 0;
  const lado = ['LEF', 'LED', 'LDD', 'LDF', 'LE', 'LD'].find(codigo => pos.endsWith(codigo));
  const ordemLado = { LE: 1, LD: 2, LEF: 1, LED: 2, LDD: 3, LDF: 4 };
  return eixo ? eixo * 10 + (ordemLado[lado] || 9) : 999;
}

function renderRodaPneu(pos, pneu, linha = 'top') {
  const cpkNovo = pneu ? cpkPneu(pneu) : null;
  const estadoNovo = pneu && cpkNovo === null ? 'sem-km' : pneu && cpkNovo > 0.1 ? 'alto-cpk' : '';
  const tituloNovo = pneu
    ? [
      `Fogo: ${pneu.numPneu}`,
      `Marca: ${pneu.marca || '-'}`,
      `Medida: ${pneu.medida || '-'}`,
      `Posicao: ${rotuloPosicaoPneu(pos.nomeLocal || pos.codigo)}`,
      `KM: ${kmFormatado(pneu.kmRodadoTotal)}`,
      `CPK: ${cpkNovo !== null ? cpkFormatado(cpkNovo) : '-'}`
    ].join('\n')
    : `${pos.codigo} - Posicao vazia`;
  const fogo = `<div class="fogo-box ${pneu ? 'ocupado' : 'vazio'}">${pneu ? escapeHtml(pneu.numPneu) : ''}</div>`;
  const roda = `<div class="tire ${pneu ? 'ocupado' : 'vazio'} ${estadoNovo}" title="${escapeHtml(tituloNovo)}">
    <span>${escapeHtml(pos.codigo)}</span>
  </div>`;
  return `<div class="tire-slot ${linha}">${linha === 'top' ? fogo + roda : roda + fogo}</div>`;
  const titulo = pneu ? `${pos.codigo} - Rodando` : `${pos.codigo} - Posição vazia`;
  return `<div class="tire ${pneu ? 'ocupado' : 'vazio'}" title="${titulo}"><span>${pos.codigo}</span></div>`;
}

function gerarEixosParaVeiculo(tipo) {
  const tipoFormatado = (tipo || '').toLowerCase();
  
  const eixoDirecional = { nome: '1º Eixo', tipo: 'simples', top: [{ codigo: 'LD' }], bottom: [{ codigo: 'LE' }] };
  const eixoTracao = (num) => ({ nome: `${num}º Eixo`, tipo: 'duplo', top: [{ codigo: 'LDF' }, { codigo: 'LDD' }], bottom: [{ codigo: 'LEF' }, { codigo: 'LED' }] });
  const eixoStep = { nome: 'Steps', tipo: 'step', top: [{ codigo: 'STEP', nomeLocal: 'STEP - 2' }], bottom: [{ codigo: 'STEP', nomeLocal: 'STEP - 1' }] };

  if (tipoFormatado === 'cavalo' || tipoFormatado.includes('toco')) {
    return [eixoDirecional, eixoTracao(2), eixoTracao(3), eixoStep];
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

function normalizarTextoCatalogo(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function valoresUnicosOrdenados(lista) {
  const mapa = new Map();
  lista.forEach(valor => {
    const texto = String(valor || '').trim();
    if (!texto) return;
    const chave = normalizarTextoCatalogo(texto);
    if (!mapa.has(chave)) mapa.set(chave, texto);
  });
  return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function resolverValorCatalogo(valor, opcoes, forcarMaiusculo = false) {
  const texto = String(valor || '').trim();
  if (!texto) return '';
  const chave = normalizarTextoCatalogo(texto);
  const existente = opcoes.find(opcao => normalizarTextoCatalogo(opcao) === chave);
  return existente || (forcarMaiusculo ? texto.toUpperCase() : texto);
}

function catalogoPneus() {
  const pneus = getData(KEYS.PNEUS);
  const marcas = valoresUnicosOrdenados(pneus.map(p => p.marca));
  const modelos = valoresUnicosOrdenados(pneus.map(p => p.modelo));
  return { pneus, marcas, modelos };
}

function preencherDatalist(id, valores) {
  const lista = $(id);
  if (!lista) return;
  lista.innerHTML = valores.map(valor => `<option value="${escapeHtml(valor)}"></option>`).join('');
}

function preencherSugestoesCadastroPneu() {
  const { pneus, marcas, modelos } = catalogoPneus();
  const marcaAtual = normalizarTextoCatalogo(getVal('marca'));
  const modelosDaMarca = marcaAtual
    ? valoresUnicosOrdenados(pneus
      .filter(p => normalizarTextoCatalogo(p.marca) === marcaAtual)
      .map(p => p.modelo))
    : modelos;

  preencherDatalist('listaMarcasPneu', marcas);
  preencherDatalist('listaFiltroMarcasPneu', marcas);
  preencherDatalist('listaModelosPneu', modelosDaMarca.length ? modelosDaMarca : modelos);
  preencherDatalist('listaMedidasPneu', valoresUnicosOrdenados(pneus.map(p => p.medida)));
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
  preencherSugestoesCadastroPneu();
  ['marca', 'modelo', 'medida'].forEach(id => {
    if ($(id)) {
      $(id).addEventListener('focus', preencherSugestoesCadastroPneu);
      $(id).addEventListener('input', preencherSugestoesCadastroPneu);
      $(id).addEventListener('blur', () => {
        const { marcas, modelos } = catalogoPneus();
        if (id === 'marca') setVal(id, resolverValorCatalogo(getVal(id), marcas, true));
        if (id === 'modelo') setVal(id, resolverValorCatalogo(getVal(id), modelos, true));
      });
    }
  });
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
  const { marcas, modelos } = catalogoPneus();
  const p = {
    id: gerarId(), codSistema: getVal('codSistema'), numPneu: getVal('numPneu'),
    marca: resolverValorCatalogo(getVal('marca'), marcas, true),
    modelo: resolverValorCatalogo(getVal('modelo'), modelos, true),
    tipo: getVal('tipo'), medida: getVal('medida'), dataCompra: getVal('dataCompra'),
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
    preencherSugestoesCadastroPneu();
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

function cpkMedioListaPneus(pneus) {
  const comCpk = pneus.filter(p => cpkPneu(p) !== null);
  const km = comCpk.reduce((a, p) => a + asNumber(p.kmRodadoTotal), 0);
  const custo = comCpk.reduce((a, p) => a + custoTotalPneu(p), 0);
  return km > 0 ? custo / km : null;
}

function renderResumoFiltrosPneus(pneusFiltrados) {
  const painel = $('pneuResumoFiltros');
  const marcasBox = $('pneuMarcasResumo');
  if (!painel && !marcasBox) return;

  const cpkMedio = cpkMedioListaPneus(pneusFiltrados);
  const custo = pneusFiltrados.reduce((a, p) => a + custoTotalPneu(p), 0);
  const km = pneusFiltrados.reduce((a, p) => a + asNumber(p.kmRodadoTotal), 0);
  const resumo = [
    ['Pneus filtrados', pneusFiltrados.length],
    ['Marcas', new Set(pneusFiltrados.map(p => p.marca || 'Marca nao informada')).size],
    ['Rodando', pneusFiltrados.filter(p => p.statusAtual === 'Rodando').length],
    ['Estoque', pneusFiltrados.filter(p => p.statusAtual === 'Estoque').length],
    ['Custo filtrado', moeda(custo)],
    ['CPK medio', cpkMedio !== null ? cpkFormatado(cpkMedio) : '-']
  ];

  if (painel) {
    painel.innerHTML = resumo.map(([label, valor]) => `
      <div class="filter-summary-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(valor))}</strong>
      </div>
    `).join('');
  }

  if (marcasBox) {
    const marcas = Object.values(pneusFiltrados.reduce((acc, p) => {
      const nome = p.marca || 'Marca nao informada';
      if (!acc[nome]) acc[nome] = { marca: nome, qtd: 0, rodando: 0, custo: 0, km: 0 };
      acc[nome].qtd++;
      if (p.statusAtual === 'Rodando') acc[nome].rodando++;
      acc[nome].custo += custoTotalPneu(p);
      acc[nome].km += asNumber(p.kmRodadoTotal);
      return acc;
    }, {})).sort((a, b) => b.qtd - a.qtd || a.marca.localeCompare(b.marca, 'pt-BR'));

    marcasBox.innerHTML = marcas.length
      ? marcas.map(item => `
        <button type="button" class="brand-count-chip" data-marca="${escapeHtml(item.marca)}">
          <strong>${escapeHtml(item.marca)}</strong>
          <span>${item.qtd} pneu(s)</span>
          <small>${item.rodando} rodando</small>
        </button>
      `).join('')
      : '<div class="empty-state compact">Nenhuma marca encontrada nos filtros.</div>';

    marcasBox.querySelectorAll('[data-marca]').forEach(btn => {
      btn.addEventListener('click', () => {
        setVal('filtroMarca', btn.dataset.marca || '');
        renderPneus();
      });
    });
  }
}

function renderPneus() {
  const tbody = $('corpoTabelaPneus'); if (!tbody) return;
  const pneus = getData(KEYS.PNEUS);
  preencherSugestoesCadastroPneu();
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
  renderResumoFiltrosPneus(f);
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
    `Veículo/local: ${pneu.veiculoAtual || '-'} / ${rotuloPosicaoPneu(pneu.localAtual || '-')}`,
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
      <div class="detail-kpi"><span>Local atual</span><strong>${escapeHtml(pneu.veiculoAtual || '-')}</strong><small>${escapeHtml(rotuloPosicaoPneu(pneu.localAtual || '-'))}</small></div>
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
  definirPeriodoPadraoMovimentacoes();
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

function definirPeriodoPadraoMovimentacoes() {
  // A tela de movimentacoes deve abrir mostrando tudo que veio do banco.
  // O usuario filtra por periodo apenas quando quiser restringir a consulta.
}

function popularSelectVeiculos(filtroMotorista = '') {
  prepararCamposPesquisaveis();
  const veiculosTodos = getData(KEYS.VEICULOS);
  const motorista = normalizarChave(filtroMotorista);
  const vinculados = motorista ? veiculosTodos.filter(v => {
    const nomeVinculado = normalizarChave(v.motorista);
    return nomeVinculado && (nomeVinculado.includes(motorista) || motorista.includes(nomeVinculado));
  }) : [];
  const veiculos = vinculados.length ? vinculados : veiculosTodos;
  const opcoes = veiculos.map(v => ({
    value: v.placa,
    label: `${v.placa} ${v.modelo || ''}`,
    meta: [v.modelo, v.motorista].filter(Boolean).join(' / ')
  }));
  document.querySelectorAll('.select-veiculos').forEach(campo => {
    if (campo.dataset) campo.dataset.smartType = 'placa';
    atualizarCampoPesquisavel(campo, opcoes, 'Digite ou selecione a placa');
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
  const placaMovimentacao = placaCadastrada(m.veiculoAtual);
  if (placaMovimentacao) {
    m.veiculoAtual = placaMovimentacao;
    m.placa_veiculo = placaMovimentacao;
  }

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

function movimentacaoBadgeClass(tipoMov) {
  return classeBadgeTipoMov(tipoMov);
}

function limparFiltrosMovimentacoes() {
  ['filtroMovDataInicial', 'filtroMovDataFinal', 'filtroMovPneu', 'filtroMovVeiculo', 'filtroMovLocal', 'filtroMovTipo', 'buscaHistoricoMov']
    .forEach(id => setVal(id));
  const todos = document.querySelector('input[name="filtroMovSituacao"][value=""]');
  if (todos) todos.checked = true;
  renderHistoricoMov();
}

function atualizarResumoFiltrosMovimentacoes(filtrados) {
  const resumo = $('resumoFiltrosMovimentacoes');
  const tiposBox = $('resumoTiposMovimentacoes');
  const dataInicial = getVal('filtroMovDataInicial');
  const dataFinal = getVal('filtroMovDataFinal');
  const partes = [];
  if (dataInicial || dataFinal) {
    const ini = dataInicial ? new Date(`${dataInicial}T00:00:00`).toLocaleDateString('pt-BR') : 'inicio';
    const fim = dataFinal ? new Date(`${dataFinal}T00:00:00`).toLocaleDateString('pt-BR') : 'hoje';
    partes.push(`${ini} a ${fim}`);
  }
  if (getVal('filtroMovPneu')) partes.push(`Pneu ${getVal('filtroMovPneu')}`);
  if (getVal('filtroMovVeiculo')) partes.push(`Veiculo ${getVal('filtroMovVeiculo')}`);
  if (getVal('filtroMovLocal')) partes.push(`Local ${getVal('filtroMovLocal')}`);
  if (getVal('filtroMovTipo')) partes.push(tipoMovimentacaoLabel(getVal('filtroMovTipo')));
  if (resumo) resumo.textContent = partes.length ? partes.join(' | ') : 'Todos os registros do banco';

  if (!tiposBox) return;
  const ordem = ['Instalacao', 'Atualizacao', 'Retirada', 'Recapagem', 'Baixa'];
  const contagem = filtrados.reduce((acc, m) => {
    const tipo = m.tipo_movimentacao || m.tipoMov || 'Outros';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});
  tiposBox.innerHTML = ordem
    .filter(tipo => contagem[tipo])
    .map(tipo => `<span class="movement-type-pill ${classeBadgeTipoMov(tipo)}">${tipoMovimentacaoLabel(tipo)}: ${contagem[tipo]}</span>`)
    .join('');
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
  atualizarResumoFiltrosMovimentacoes(filtrados);
  if ($('totalMovimentacoesConsulta')) {
    $('totalMovimentacoesConsulta').textContent = filtrados.length === 1
      ? '1 movimentação'
      : `${filtrados.length.toLocaleString('pt-BR')} movimentações`;
  }

  tbody.innerHTML = '';
  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhuma movimentação encontrada.</td></tr>';
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
      <td>${escapeHtml(destinoMovimentacaoTabela(m))}</td>
      <td>${escapeHtml(localDestinoMovimentacao(m))}</td>
      <td class="actions-cell" title="${escapeHtml(m.observacao || '')}">
        <button class="btn-icon" onclick="editarMovimentacao('${escapeHtml(m.id)}')" title="Editar">✏️</button>
        <button class="btn-icon btn-icon-danger" onclick="excluirMovimentacao('${escapeHtml(m.id)}')" title="Apagar">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (filtrados.length > exibidos.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" class="text-center">Mostrando ${exibidos.length} de ${filtrados.length}. Use os filtros para localizar uma movimentação específica.</td>`;
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

async function excluirMovimentacao(id) {
  if (!confirm('Excluir esta movimentação permanentemente? (Isso não reverterá os efeitos no pneu)')) return;
  try {
    await apiExcluirMovimentacao(id);
    saveData(KEYS.MOVS, getData(KEYS.MOVS).filter(m => m.id !== id));
    notificar('Movimentação apagada do banco.', 'success');
    await sincronizarDadosBanco(['movimentacoes', 'pneus']);
    renderHistoricoMov();
  } catch (error) {
    notificar(error.message || 'Erro ao apagar movimentação.', 'error');
  }
}

let conferenciaItensMotorista = [];

function mostrarSecaoMotorista(secao) {
  const alvo = secao || 'pneus';
  document.querySelectorAll('[data-driver-panel]').forEach(panel => {
    panel.classList.toggle('is-active', panel.dataset.driverPanel === alvo);
  });
  document.querySelectorAll('[data-driver-panel-target]').forEach(botao => {
    const ativo = botao.dataset.driverPanelTarget === alvo;
    botao.classList.toggle('is-active', ativo);
    botao.setAttribute('aria-pressed', ativo ? 'true' : 'false');
  });
}

function initDriverSections() {
  document.querySelectorAll('[data-driver-panel-target]').forEach(botao => {
    if (botao.dataset.bound) return;
    botao.addEventListener('click', () => mostrarSecaoMotorista(botao.dataset.driverPanelTarget));
    botao.dataset.bound = '1';
  });
  const ativo = document.querySelector('[data-driver-panel].is-active')?.dataset.driverPanel || 'pneus';
  mostrarSecaoMotorista(ativo);
}

function initMotoristaApp(usuario) {
  initDriverSections();
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
  initFormDriverNovoAcerto(usuario);
  preencherDriverAcertos(usuario);
  initFormDriverLancamento(usuario);
  initFormDriverAdiantamento(usuario);
  renderDriverLancamentos(usuario);
  renderDriverAcertos(usuario);
}

function pneusEsperadosDoVeiculo(placa) {
  return getData(KEYS.PNEUS)
    .filter(p => p.statusAtual === 'Rodando' && normalizarChave(p.veiculoAtual) === normalizarChave(placa))
    .sort((a, b) => ordemPosicaoPneu(a.localAtual) - ordemPosicaoPneu(b.localAtual));
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
  box.innerHTML = pneus.map(p => {
    const posicao = rotuloPosicaoPneu(p.localAtual);
    const codigo = normalizarPosicaoPneu(p.localAtual);
    const codigoHtml = codigo && codigo !== normalizarChave(posicao)
      ? `<small class="driver-position-raw">Codigo: ${escapeHtml(codigo)}</small>`
      : '';
    return `
    <article class="driver-expected-item">
      <div>
        <strong class="driver-position-label">${escapeHtml(posicao)}</strong>
        <span>Fogo ${escapeHtml(p.numPneu)} - ${escapeHtml(p.marca || '-')}</span>
        ${codigoHtml}
      </div>
      <div class="driver-expected-actions">
        <button type="button" onclick="selecionarPneuConferenciaMotorista('${escapeHtml(p.numPneu)}','Atualizacao')">Atualizar</button>
        <button type="button" onclick="selecionarPneuConferenciaMotorista('${escapeHtml(p.numPneu)}','Troca')">Trocar</button>
        <button type="button" onclick="selecionarPneuConferenciaMotorista('${escapeHtml(p.numPneu)}','Retirada')">Retirar</button>
      </div>
    </article>`;
  }).join('');
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
    throw new Error('Informe o Nº de fogo do pneu.');
  }

  if (!item.localAtual) throw new Error('Informe eixo e lado para gerar a posição.');
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
      <span>${escapeHtml(rotuloPosicaoPneu(item.localAtual || '-'))}</span>
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
  const veiculo = placaCadastrada(getVal('veiculoAtual')) || getVal('veiculoAtual');
  const kmVeiculo = Number(getVal('kmVeiculo')) || 0;

  if (!dataConferencia) return notificar('Informe a data da conferencia.', 'error');
  if (!veiculo) return notificar('Selecione o veiculo.', 'error');
  if (!placaExisteCadastro(veiculo)) {
    atualizarEstadoCampoPesquisavel($('veiculoAtual'));
    return notificar(`A placa ${veiculo} nao existe no cadastro de veiculos.`, 'error');
  }
  setVal('veiculoAtual', veiculo);
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
  const local = veiculo === 'Estoque' ? 'Estoque' : rotuloPosicaoPneu(pneu.localAtual && pneu.localAtual !== '-' ? pneu.localAtual : 'Sem posicao');
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
    const posicao = rotuloPosicaoPneu(item.localAtual || '-');
    if (item.tipo === 'Troca') return `Troca ${item.pneuSaiu || '-'} -> ${item.pneuEntrou || '-'} (${posicao})`;
    return `${tipoMovimentacaoLabel(item.tipo)} ${item.numeroPneu || '-'} (${posicao})`;
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

/* === MODULOS OPERACIONAIS === */
const MODULOS_OPERACIONAIS = {
  'acerto-viagem-page': {
    key: KEYS.ACERTOS,
    form: 'formAcertoViagem',
    table: 'tabelaAcertosViagem',
    total: 'acertoTotal',
    valor: 'acertoValor',
    pendentes: 'acertoPendentes',
    campos: ['numeroViagem', 'dataSaida', 'dataRetorno', 'dataAcerto', 'motorista', 'veiculo', 'origemDestino',
      'localCarregamento', 'ufCarregamento', 'localDescarregamento', 'ufDescarregamento',
      'valorTonelada', 'toneladas', 'kmInicial', 'kmFinal', 'receita', 'despesas', 'adiantamento',
      'mediaLitrosKm', 'status', 'observacao', 'motivoDevolucao'],
    colunas: ['', 'No Viagem', 'Placa', 'Motorista', 'Data Inicio', 'Data Term.', 'Km Perc.', 'Media Km', 'Status', 'Abrir'],
    montarLinha(item) {
      const km = Math.max(0, asNumber(item.kmFinal) - asNumber(item.kmInicial));
      const receita = calcularFreteAcerto(item);
      const saldo = receita - asNumber(item.despesas);
      return [
        `${formatarDataDashboard(item.dataSaida)} a ${formatarDataDashboard(item.dataRetorno)}`,
        item.motorista, item.veiculo, resumoRotaAcerto(item), kmFormatado(km),
        moeda(receita), moeda(item.despesas), moeda(saldo), item.status
      ];
    },
    valorTotal(item) {
      return calcularFreteAcerto(item) - asNumber(item.despesas);
    }
  },
  'manutencao-page': {
    key: KEYS.MANUTENCOES,
    form: 'formManutencao',
    table: 'tabelaManutencoes',
    total: 'manutencaoTotal',
    valor: 'manutencaoValor',
    pendentes: 'manutencaoPendentes',
    campos: ['data', 'veiculo', 'tipo', 'km', 'oficina', 'item', 'valor', 'status', 'observacao'],
    colunas: ['Data', 'Veiculo', 'Tipo', 'Item', 'KM', 'Oficina', 'Valor', 'Status'],
    montarLinha(item) {
      return [formatarDataDashboard(item.data), item.veiculo, item.tipo, item.item, kmFormatado(item.km), item.oficina, moeda(item.valor), item.status];
    },
    valorTotal(item) {
      return asNumber(item.valor);
    }
  }
};
MODULOS_OPERACIONAIS['acerto-viagem-detalhe-page'] = MODULOS_OPERACIONAIS['acerto-viagem-page'];

function normalizarBuscaCampo(valor, tipo = 'texto') {
  return tipo === 'placa' ? normalizarPlaca(valor) : normalizarChave(valor);
}

function resolverValorCadastrado(valor, tipo = 'texto') {
  if (tipo === 'placa') return placaCadastrada(valor);
  if (tipo === 'motorista') return motoristaCadastrado(valor);
  return valor;
}

function atualizarEstadoCampoPesquisavel(input) {
  if (!input || input.dataset.skipSmartValidation === '1') return true;
  const tipo = input.dataset.smartType || 'texto';
  const valor = input.value.trim();
  const confirmado = resolverValorCadastrado(valor, tipo);
  if (confirmado) input.value = confirmado;
  const valido = !valor || !!confirmado;
  const nome = tipo === 'motorista' ? 'Motorista' : 'Placa';
  input.classList.toggle('is-invalid', !valido);
  input.title = valido ? '' : `${nome} nao encontrado no cadastro.`;
  return valido;
}

function filtrarOpcoesPesquisaveis(input) {
  const opcoes = Array.isArray(input.__smartOptions) ? input.__smartOptions : [];
  const tipo = input.dataset.smartType || 'texto';
  const busca = normalizarBuscaCampo(input.value, tipo);
  if (!busca) return opcoes.slice(0, 12);
  return opcoes
    .filter(opcao => normalizarBuscaCampo(`${opcao.value} ${opcao.label} ${opcao.meta || ''}`, tipo).includes(busca))
    .slice(0, 12);
}

function fecharDropdownPesquisavel(input) {
  const wrap = input?.closest('.smart-combobox');
  if (!wrap) return;
  wrap.classList.remove('is-open');
}

function selecionarOpcaoPesquisavel(input, opcao) {
  input.value = opcao.value;
  input.classList.remove('is-invalid');
  input.title = '';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  fecharDropdownPesquisavel(input);
}

function renderDropdownPesquisavel(input) {
  const wrap = input.closest('.smart-combobox');
  const panel = wrap?.querySelector('.smart-combobox-panel');
  if (!wrap || !panel) return;
  const opcoes = filtrarOpcoesPesquisaveis(input);
  if (!opcoes.length) {
    panel.innerHTML = '<div class="smart-combobox-empty">Nenhum cadastro encontrado</div>';
    wrap.classList.add('is-open');
    return;
  }
  panel.innerHTML = opcoes.map((opcao, index) => `
    <button type="button" class="smart-combobox-option" data-index="${index}">
      <strong>${escapeHtml(opcao.value)}</strong>
      ${opcao.meta ? `<span>${escapeHtml(opcao.meta)}</span>` : ''}
    </button>
  `).join('');
  panel.querySelectorAll('.smart-combobox-option').forEach((botao, index) => {
    botao.addEventListener('mousedown', event => {
      event.preventDefault();
      selecionarOpcaoPesquisavel(input, opcoes[index]);
    });
  });
  wrap.classList.add('is-open');
}

function configurarEventosCampoPesquisavel(input) {
  if (!input || input.dataset.smartBound === '1') return;
  input.addEventListener('input', () => {
    if (input.dataset.smartType === 'placa') input.value = input.value.toUpperCase();
    const tipo = input.dataset.smartType || 'texto';
    const digitado = normalizarBuscaCampo(input.value, tipo);
    const confirmado = resolverValorCadastrado(input.value, tipo);
    const minimo = tipo === 'placa' ? 7 : 3;
    const invalido = input.dataset.skipSmartValidation !== '1' && digitado.length >= minimo && !confirmado;
    input.classList.toggle('is-invalid', invalido);
    input.title = invalido ? `${tipo === 'motorista' ? 'Motorista' : 'Placa'} nao encontrado no cadastro.` : '';
    renderDropdownPesquisavel(input);
  });
  input.addEventListener('focus', () => renderDropdownPesquisavel(input));
  input.addEventListener('change', () => atualizarEstadoCampoPesquisavel(input));
  input.addEventListener('blur', () => {
    setTimeout(() => fecharDropdownPesquisavel(input), 120);
    atualizarEstadoCampoPesquisavel(input);
  });
  input.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'Enter') return;
    const primeira = input.closest('.smart-combobox')?.querySelector('.smart-combobox-option');
    if (primeira) {
      event.preventDefault();
      primeira.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }
  });
  input.dataset.smartBound = '1';
}

function transformarCampoPesquisavel(campo, config) {
  if (!campo) return null;
  if (campo.tagName !== 'SELECT') {
    campo.dataset.smartType = config.tipo;
    campo.dataset.skipSmartValidation = config.validar === false ? '1' : campo.dataset.skipSmartValidation || '';
    configurarEventosCampoPesquisavel(campo);
    return campo;
  }

  const input = document.createElement('input');
  [...campo.attributes].forEach(attr => {
    if (['multiple', 'size'].includes(attr.name)) return;
    input.setAttribute(attr.name, attr.value);
  });
  input.type = 'text';
  input.value = campo.value || '';
  input.className = campo.className || 'form-control';
  input.placeholder = config.placeholder || campo.getAttribute('placeholder') || 'Pesquisar';
  input.autocomplete = 'off';
  input.dataset.smartType = config.tipo;
  input.dataset.skipSmartValidation = config.validar === false || (campo.id && campo.id.startsWith('filtro')) ? '1' : '';

  const wrap = document.createElement('div');
  wrap.className = `smart-combobox smart-combobox-${config.tipo}`;
  const panel = document.createElement('div');
  panel.className = 'smart-combobox-panel';
  wrap.appendChild(input);
  wrap.appendChild(panel);
  campo.replaceWith(wrap);
  configurarEventosCampoPesquisavel(input);
  return input;
}

function prepararCamposPesquisaveis() {
  document.querySelectorAll('select[data-select-veiculos], select.select-veiculos').forEach(select => {
    transformarCampoPesquisavel(select, { tipo: 'placa', placeholder: 'Digite a placa' });
  });
  document.querySelectorAll('select[data-select-motoristas]').forEach(select => {
    transformarCampoPesquisavel(select, { tipo: 'motorista', placeholder: 'Digite o motorista' });
  });
}

function atualizarCampoPesquisavel(campoEl, opcoes, placeholder) {
  if (!campoEl) return;
  if (campoEl.tagName === 'SELECT') {
    const atual = campoEl.value;
    campoEl.innerHTML = `<option value="">${placeholder}</option>` + opcoes.map(opcao => `<option value="${escapeHtml(opcao.value)}">${escapeHtml(opcao.label || opcao.value)}</option>`).join('');
    if (opcoes.some(opcao => opcao.value === atual)) campoEl.value = atual;
    return;
  }
  campoEl.__smartOptions = opcoes;
  campoEl.placeholder = placeholder;
  const confirmado = resolverValorCadastrado(campoEl.value, campoEl.dataset.smartType);
  if (confirmado) campoEl.value = confirmado;
}

function preencherSelectOperacional(id, dados, campo, placeholder, tipo = 'texto') {
  const campoEl = $(id);
  if (!campoEl) return;
  const opcoes = valoresUnicosOrdenados(dados.map(item => item[campo])).map(valor => ({ value: valor, label: valor }));
  if (campoEl.dataset) campoEl.dataset.smartType = tipo;
  atualizarCampoPesquisavel(campoEl, opcoes, placeholder);
}

function preencherCombosOperacionais() {
  const veiculos = getData(KEYS.VEICULOS);
  const motoristas = getData(KEYS.MOTORISTAS);
  prepararCamposPesquisaveis();
  document.querySelectorAll('[data-select-veiculos]').forEach(campo => preencherSelectOperacional(campo.id, veiculos, 'placa', 'Digite ou selecione a placa', 'placa'));
  document.querySelectorAll('[data-select-motoristas]').forEach(campo => preencherSelectOperacional(campo.id, motoristas, 'nome', 'Digite ou selecione o motorista', 'motorista'));
  document.querySelectorAll('[data-select-acertos]').forEach(select => preencherSelectAcertos(select));
}

function badgeStatusOperacional(status) {
  const s = String(status || '').toLowerCase();
  if (['aprovado', 'finalizado', 'pago', 'concluido', 'conferido'].includes(s)) return 'badge-success';
  if (['pendente', 'aberto', 'em analise', 'em andamento'].includes(s)) return 'badge-warning';
  if (['recusado', 'cancelado', 'vencido'].includes(s)) return 'badge-danger';
  if (['devolvido', 'devolvida', 'substituido'].includes(s)) return 'badge-info';
  return 'badge-info';
}

function proximoNumeroViagem() {
  const numeros = getData(KEYS.ACERTOS)
    .map(item => Number(String(item.numeroViagem || '').replace(/\D/g, '')))
    .filter(Number.isFinite);
  const proximo = (numeros.length ? Math.max(...numeros) : 4400) + 1;
  return String(proximo).padStart(5, '0');
}

function acertoSelecionadoAtual() {
  const id = getVal('acertoId');
  return getData(KEYS.ACERTOS).find(item => item.id === id) || null;
}

function calcularFreteAcerto(item = null) {
  const valorTonelada = item ? asNumber(item.valorTonelada) : asNumber(getVal('valorTonelada'));
  const toneladas = item ? asNumber(item.toneladas) : asNumber(getVal('toneladas'));
  const calculado = valorTonelada * toneladas;
  if (calculado > 0) return calculado;
  return item ? asNumber(item.receita) : asNumber(getVal('receita'));
}

function resumoRotaAcerto(item = {}) {
  const origem = [item.localCarregamento, item.ufCarregamento].filter(Boolean).join(' / ');
  const destino = [item.localDescarregamento, item.ufDescarregamento].filter(Boolean).join(' / ');
  if (origem || destino) return `${origem || '-'} -> ${destino || '-'}`;
  return item.origemDestino || '-';
}

function origemDestinoFormularioAcerto() {
  const item = {
    localCarregamento: getVal('localCarregamento'),
    ufCarregamento: getVal('ufCarregamento').toUpperCase(),
    localDescarregamento: getVal('localDescarregamento'),
    ufDescarregamento: getVal('ufDescarregamento').toUpperCase()
  };
  if (!item.localCarregamento && !item.ufCarregamento && !item.localDescarregamento && !item.ufDescarregamento) return '';
  return resumoRotaAcerto(item);
}

function totaisLancamentosAcerto(acertoId) {
  const base = { despesas: 0, adiantamentos: 0, aprovados: 0, pendentes: 0, solicitacoes: 0 };
  if (!acertoId) return base;
  return getData(KEYS.LANCAMENTOS_ACERTO).reduce((acc, item) => {
    if (item.acertoId !== acertoId) return acc;
    if (statusLancamentoPendente(item.status)) acc.pendentes += 1;
    if (item.tipo === 'Solicitacao') acc.solicitacoes += 1;
    if (!statusLancamentoAprovado(item.status) || !tiposComValorNoAcerto(item)) return acc;
    acc.aprovados += asNumber(item.valor);
    if (lancamentoEhAdiantamento(item)) acc.adiantamentos += asNumber(item.valor);
    else acc.despesas += asNumber(item.valor);
    return acc;
  }, base);
}

function atualizarFreteAcertoForm() {
  const frete = calcularFreteAcerto();
  if ($('receita')) setVal('receita', frete ? String(frete) : '0');
  if ($('freteCalculadoPreview')) $('freteCalculadoPreview').textContent = moeda(frete);
  renderResumoAcertoSelecionado();
}

function encontrarAcertoCompativelLancamento(lancamento) {
  const motorista = normalizarChave(lancamento?.motorista);
  const veiculo = normalizarPlaca(lancamento?.veiculo);
  const data = dataIsoCurta(lancamento?.data);
  if (!motorista || !veiculo) return null;

  const statusFechado = new Set(['FINALIZADO', 'CANCELADO', 'ENCERRADO', 'ENCERRADA', 'PAGO', 'PAGA']);
  const candidatos = getData(KEYS.ACERTOS)
    .filter(acerto => !statusFechado.has(normalizarChave(acerto.status)))
    .filter(acerto => normalizarChave(acerto.motorista) === motorista && normalizarPlaca(acerto.veiculo) === veiculo)
    .sort((a, b) => String(b.dataSaida || b.criadoEm || '').localeCompare(String(a.dataSaida || a.criadoEm || '')));

  if (!data) return candidatos[0] || null;
  return candidatos.find(acerto => {
    const inicio = dataIsoCurta(acerto.dataSaida);
    const fim = dataIsoCurta(acerto.dataRetorno || acerto.dataAcerto);
    if (inicio && data < inicio) return false;
    if (fim && data > fim) return false;
    return true;
  }) || candidatos[0] || null;
}

function novoAcertoViagem(scroll = true) {
  if (!$('formAcertoViagem') && document.body.id === 'acerto-viagem-page') {
    window.location.href = 'acerto-viagem-detalhe.html';
    return;
  }
  ['acertoId', 'numeroViagem', 'dataSaida', 'dataRetorno', 'dataAcerto', 'motorista', 'veiculo', 'origemDestino',
    'localCarregamento', 'ufCarregamento', 'localDescarregamento', 'ufDescarregamento',
    'valorTonelada', 'toneladas', 'kmInicial', 'kmFinal', 'receita', 'despesas', 'adiantamento',
    'mediaLitrosKm', 'status', 'observacao', 'motivoDevolucao'].forEach(id => setVal(id));
  setVal('numeroViagem', proximoNumeroViagem());
  setVal('dataAcerto', new Date().toISOString().split('T')[0]);
  if ($('status')) $('status').value = 'Aberto';
  if ($('lanAcerto')) $('lanAcerto').value = '';
  if ($('acertoFormTitulo')) $('acertoFormTitulo').textContent = 'Novo acerto';
  if ($('acertoSelecionadoChip')) $('acertoSelecionadoChip').textContent = 'Nova viagem';
  atualizarFreteAcertoForm();
  renderResumoAcertoSelecionado();
  if (document.body.id === 'acerto-viagem-detalhe-page') {
    window.history.replaceState({}, '', 'acerto-viagem-detalhe.html');
  }
  if (scroll) $('acertoDetalhePanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function preencherAcertoNoFormulario(item) {
  if (!item) return novoAcertoViagem(false);
  setVal('acertoId', item.id);
  setVal('numeroViagem', item.numeroViagem || '');
  setVal('dataSaida', item.dataSaida || '');
  setVal('dataRetorno', item.dataRetorno || '');
  setVal('dataAcerto', item.dataAcerto || '');
  setVal('motorista', item.motorista || '');
  setVal('veiculo', item.veiculo || '');
  setVal('origemDestino', item.origemDestino || '');
  setVal('localCarregamento', item.localCarregamento || '');
  setVal('ufCarregamento', item.ufCarregamento || '');
  setVal('localDescarregamento', item.localDescarregamento || '');
  setVal('ufDescarregamento', item.ufDescarregamento || '');
  setVal('valorTonelada', item.valorTonelada || '');
  setVal('toneladas', item.toneladas || '');
  setVal('kmInicial', item.kmInicial || '');
  setVal('kmFinal', item.kmFinal || '');
  setVal('receita', calcularFreteAcerto(item) || '');
  setVal('despesas', item.despesas || '');
  setVal('adiantamento', item.adiantamento || '');
  setVal('mediaLitrosKm', item.mediaLitrosKm || '');
  setVal('status', item.status || 'Pendente');
  setVal('observacao', item.observacao || '');
  setVal('motivoDevolucao', item.motivoDevolucao || '');
  if ($('lanAcerto')) $('lanAcerto').value = item.id;
  if ($('lanMotorista')) $('lanMotorista').value = item.motorista || '';
  if ($('lanVeiculo')) $('lanVeiculo').value = item.veiculo || '';
  if ($('acertoFormTitulo')) $('acertoFormTitulo').textContent = `Acerto da viagem ${item.numeroViagem || '-'}`;
  if ($('acertoSelecionadoChip')) $('acertoSelecionadoChip').textContent = `${item.veiculo || '-'} / ${item.motorista || '-'}`;
  atualizarFreteAcertoForm();
  renderResumoAcertoSelecionado();
}

function selecionarAcertoViagem(id, opcoes = {}) {
  if (!$('formAcertoViagem')) {
    window.location.href = `acerto-viagem-detalhe.html?id=${encodeURIComponent(id)}`;
    return;
  }
  const item = getData(KEYS.ACERTOS).find(acerto => acerto.id === id);
  if (!item) return;
  preencherCombosOperacionais();
  preencherAcertoNoFormulario(item);
  const configAtual = MODULOS_OPERACIONAIS[document.body.id] || MODULOS_OPERACIONAIS['acerto-viagem-page'];
  renderTabelaAcertosViagem(configAtual);
  renderTabelaLancamentosAcerto();
  if (document.body.id === 'acerto-viagem-detalhe-page') {
    window.history.replaceState({}, '', `acerto-viagem-detalhe.html?id=${encodeURIComponent(id)}`);
  }
  if (opcoes.scroll !== false) $('acertoDetalhePanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function encerrarAcertoSelecionado() {
  const id = getVal('acertoId');
  if (!id) return notificar('Selecione ou salve uma viagem antes de encerrar.', 'error');
  setVal('status', 'Encerrado');
  $('formAcertoViagem')?.requestSubmit();
}

function aprovarAcertoSelecionado() {
  const id = getVal('acertoId');
  if (!id) return notificar('Selecione ou salve uma viagem antes de aprovar.', 'error');
  setVal('status', 'Aprovado');
  setVal('motivoDevolucao', '');
  $('formAcertoViagem')?.requestSubmit();
}

function devolverAcertoSelecionado() {
  const id = getVal('acertoId');
  if (!id) return notificar('Selecione ou salve uma viagem antes de devolver.', 'error');
  const motivo = prompt('Informe o que o motorista precisa corrigir neste acerto:');
  if (motivo === null) return;
  const texto = motivo.trim();
  if (!texto) return notificar('Informe o motivo para devolver o acerto ao motorista.', 'error');
  const obsAtual = getVal('observacao');
  const registro = `Correcao solicitada em ${new Date().toLocaleString('pt-BR')}: ${texto}`;
  setVal('status', 'Devolvido');
  setVal('motivoDevolucao', texto);
  setVal('observacao', obsAtual ? `${obsAtual}\n${registro}` : registro);
  $('formAcertoViagem')?.requestSubmit();
}

function pagarAcertoSelecionado() {
  const id = getVal('acertoId');
  if (!id) return notificar('Selecione ou salve uma viagem antes de marcar pagamento.', 'error');
  setVal('status', 'Pago');
  $('formAcertoViagem')?.requestSubmit();
}

function filtrosAcertosViagem() {
  return {
    todas: $('filtroAcertoTodas')?.checked,
    encerradas: $('filtroAcertoEncerradas')?.checked,
    pendentes: $('filtroAcertoPendentes')?.checked,
    statusTodas: $('filtroAcertoStatusTodas')?.checked,
    conferidas: $('filtroAcertoConferidas')?.checked,
    naoConferidas: $('filtroAcertoNaoConferidas')?.checked,
    inicio: getVal('filtroAcertoInicio'),
    fim: getVal('filtroAcertoFim'),
    placa: getVal('filtroAcertoPlaca'),
    numero: getVal('filtroAcertoNumero'),
    motorista: getVal('filtroAcertoMotorista')
  };
}

function passaFiltroAcertoViagem(item, filtros) {
  const status = item.status || 'Pendente';
  const encerrada = ['Finalizado', 'Encerrado', 'Pago'].includes(status);
  const conferida = ['Aprovado', 'Conferido', 'Finalizado', 'Encerrado', 'Pago'].includes(status);
  if (!filtros.todas) {
    if (filtros.encerradas && !encerrada) return false;
    if (filtros.pendentes && encerrada) return false;
  }
  if (!filtros.statusTodas) {
    if (filtros.conferidas && !conferida) return false;
    if (filtros.naoConferidas && conferida) return false;
  }
  const data = String(item.dataSaida || '').slice(0, 10);
  if (filtros.inicio && (!data || data < filtros.inicio)) return false;
  if (filtros.fim && (!data || data > filtros.fim)) return false;
  if (filtros.placa && !normalizarPlaca(item.veiculo).includes(normalizarPlaca(filtros.placa))) return false;
  if (filtros.motorista && item.motorista !== filtros.motorista) return false;
  if (filtros.numero && !String(item.numeroViagem || '').includes(filtros.numero)) return false;
  return true;
}

function renderTabelaAcertosViagem(config) {
  const tbody = $(config.table);
  if (!tbody) return;
  const filtros = filtrosAcertosViagem();
  const selecionado = getVal('acertoId');
  const lista = getData(KEYS.ACERTOS)
    .filter(item => passaFiltroAcertoViagem(item, filtros))
    .sort((a, b) => String(b.dataSaida || b.criadoEm || '').localeCompare(String(a.dataSaida || a.criadoEm || '')));

  tbody.innerHTML = '';
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">Nenhuma viagem encontrada para os filtros.</td></tr>';
    return;
  }

  lista.slice(0, MAX_TABLE_ROWS).forEach(item => {
    const km = Math.max(0, asNumber(item.kmFinal) - asNumber(item.kmInicial));
    const media = asNumber(item.mediaLitrosKm);
    const finalizado = ['Finalizado', 'Encerrado', 'Pago'].includes(item.status);
    const tr = document.createElement('tr');
    tr.className = item.id === selecionado ? 'is-selected-row' : '';
    tr.innerHTML = `
      <td><span class="trip-status-dot ${finalizado ? 'ok' : 'pending'}">${finalizado ? '✓' : '×'}</span></td>
      <td><strong>${escapeHtml(item.numeroViagem || '-')}</strong></td>
      <td>${escapeHtml(item.veiculo || '-')}</td>
      <td>${escapeHtml(item.motorista || '-')}</td>
      <td>${escapeHtml(formatarDataDashboard(item.dataSaida))}</td>
      <td>${escapeHtml(formatarDataDashboard(item.dataRetorno))}</td>
      <td>${km.toLocaleString('pt-BR')}</td>
      <td>${media ? media.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '0,000'}</td>
      <td><span class="badge ${badgeStatusOperacional(item.status)}">${escapeHtml(item.status || 'Pendente')}</span></td>
      <td><button type="button" class="btn-mini success" onclick="selecionarAcertoViagem('${escapeHtml(item.id)}')">Abrir</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function initFiltrosAcertoViagem() {
  const ids = ['filtroAcertoTodas', 'filtroAcertoEncerradas', 'filtroAcertoPendentes', 'filtroAcertoStatusTodas',
    'filtroAcertoConferidas', 'filtroAcertoNaoConferidas', 'filtroAcertoInicio', 'filtroAcertoFim',
    'filtroAcertoPlaca', 'filtroAcertoNumero', 'filtroAcertoMotorista'];
  ids.forEach(id => {
    const el = $(id);
    if (!el || el.dataset.bound) return;
    const evento = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(evento, () => renderTabelaAcertosViagem(MODULOS_OPERACIONAIS['acerto-viagem-page']));
    if (evento !== 'change') el.addEventListener('change', () => renderTabelaAcertosViagem(MODULOS_OPERACIONAIS['acerto-viagem-page']));
    el.dataset.bound = '1';
  });
}

function renderResumoAcertoSelecionado() {
  const acertoId = getVal('acertoId');
  const lancamentos = getData(KEYS.LANCAMENTOS_ACERTO)
    .filter(item => statusLancamentoAprovado(item.status) && item.acertoId === acertoId);
  const lancamentosDespesa = lancamentos.filter(item => tiposComValorNoAcerto(item) && !lancamentoEhAdiantamento(item));
  const lancamentosAdiantamento = lancamentos.filter(item => lancamentoEhAdiantamento(item));
  const despesasAprovadas = lancamentosDespesa.reduce((total, item) => total + asNumber(item.valor), 0);
  const adiantamentosAprovados = lancamentosAdiantamento.reduce((total, item) => total + asNumber(item.valor), 0);
  if (acertoId && $('despesas')) setVal('despesas', despesasAprovadas ? String(despesasAprovadas) : '0');
  if (acertoId && $('adiantamento')) setVal('adiantamento', String(adiantamentosAprovados || 0));
  const receita = calcularFreteAcerto();
  if ($('receita')) setVal('receita', receita ? String(receita) : '0');
  const adiantamento = asNumber(getVal('adiantamento')) || adiantamentosAprovados;
  const despesas = asNumber(getVal('despesas')) || despesasAprovadas;
  const resultadoOperacional = receita - despesas;
  const saldoAcerto = despesas - adiantamento;
  if ($('freteCalculadoPreview')) $('freteCalculadoPreview').textContent = moeda(receita);
  if ($('resumoFretes')) $('resumoFretes').textContent = moeda(receita);
  if ($('resumoAdiantamentos')) $('resumoAdiantamentos').textContent = moeda(adiantamento);
  if ($('resumoAdiantamentosMini')) $('resumoAdiantamentosMini').textContent = moeda(adiantamento);
  if ($('resumoReceitas')) $('resumoReceitas').textContent = moeda(receita);
  if ($('resumoDespesas')) $('resumoDespesas').textContent = moeda(despesas);
  if ($('resumoDespesasMini')) $('resumoDespesasMini').textContent = moeda(despesas);
  if ($('resumoSaldoAcerto')) $('resumoSaldoAcerto').textContent = moeda(saldoAcerto);
  if ($('resumoSaldoAcertoMini')) $('resumoSaldoAcertoMini').textContent = moeda(saldoAcerto);
  if ($('resumoLucro')) {
    $('resumoLucro').textContent = moeda(resultadoOperacional);
    $('resumoLucro').classList.toggle('danger', resultadoOperacional < 0);
  }

  const categoriasPadrao = ['Combustivel', 'Arla', 'Pecas', 'Oficina', 'Borracharia', 'Lavagem', 'Agenciamento', 'Pedagio', 'Outros'];
  const porCategoria = lancamentosDespesa.reduce((acc, item) => {
    const categoria = item.categoria || 'Outros';
    acc[categoria] = (acc[categoria] || 0) + asNumber(item.valor);
    return acc;
  }, {});
  const box = $('resumoCategoriasDespesas');
  if (box) {
    const categorias = [...new Set([...categoriasPadrao, ...Object.keys(porCategoria)])];
    box.innerHTML = categorias.map(categoria => (
      `<div><span>${escapeHtml(categoria)}</span><strong>${moeda(porCategoria[categoria] || 0)}</strong></div>`
    )).join('');
  }
}

function coletarFormularioOperacional(config) {
  const item = { id: config.key === KEYS.ACERTOS && getVal('acertoId') ? getVal('acertoId') : gerarId(), criadoEm: new Date().toISOString() };
  config.campos.forEach(campo => {
    item[campo] = getVal(campo);
  });
  if (config.key === KEYS.ACERTOS) {
    item.numeroViagem = item.numeroViagem || proximoNumeroViagem();
    item.dataAcerto = item.dataAcerto || new Date().toISOString().split('T')[0];
    item.veiculo = placaCadastrada(item.veiculo) || item.veiculo;
    item.motorista = motoristaCadastrado(item.motorista) || item.motorista;
    item.ufCarregamento = String(item.ufCarregamento || '').toUpperCase();
    item.ufDescarregamento = String(item.ufDescarregamento || '').toUpperCase();
    item.origemDestino = origemDestinoFormularioAcerto() || item.origemDestino;
    item.receita = calcularFreteAcerto(item);
    const totais = totaisLancamentosAcerto(item.id);
    item.despesas = totais.despesas;
    item.adiantamento = totais.adiantamentos;
  }
  if (config.key === KEYS.MANUTENCOES) {
    item.veiculo = placaCadastrada(item.veiculo) || item.veiculo;
  }
  return item;
}

function validarFormularioOperacional(config, item) {
  if (config.key === KEYS.ACERTOS && (!item.dataSaida || !item.motorista || !item.veiculo)) {
    return 'Informe data de saida, motorista e veiculo.';
  }
  if (config.key === KEYS.ACERTOS && item.veiculo && !placaExisteCadastro(item.veiculo)) {
    atualizarEstadoCampoPesquisavel($('veiculo'));
    return `A placa ${item.veiculo} nao existe no cadastro de veiculos.`;
  }
  if (config.key === KEYS.ACERTOS && item.motorista && !motoristaExisteCadastro(item.motorista)) {
    atualizarEstadoCampoPesquisavel($('motorista'));
    return `O motorista ${item.motorista} nao existe no cadastro de motoristas.`;
  }
  if (config.key === KEYS.MANUTENCOES && (!item.data || !item.veiculo || !item.tipo || !item.item)) {
    return 'Informe data, veiculo, tipo e item da manutencao.';
  }
  if (config.key === KEYS.MANUTENCOES && item.veiculo && !placaExisteCadastro(item.veiculo)) {
    atualizarEstadoCampoPesquisavel($('veiculo'));
    return `A placa ${item.veiculo} nao existe no cadastro de veiculos.`;
  }
  if (config.key === KEYS.DESPESAS && (!item.data || !item.categoria || !item.valor)) {
    return 'Informe data, categoria e valor da despesa.';
  }
  if (config.key === KEYS.SOLICITACOES_OPERACIONAIS && (!item.data || !item.tipo || !item.descricao)) {
    return 'Informe data, tipo e descricao da solicitacao.';
  }
  return '';
}

function limparFormularioOperacional(config) {
  if (config.key === KEYS.ACERTOS) {
    novoAcertoViagem(false);
    preencherCombosOperacionais();
    return;
  }
  config.campos.forEach(campo => setVal(campo));
  preencherCombosOperacionais();
}

function renderModuloOperacional(config) {
  if (config.key === KEYS.ACERTOS) {
    const lista = getData(config.key);
    const totalEl = $(config.total);
    const valorEl = $(config.valor);
    const pendentesEl = $(config.pendentes);
    if (totalEl) totalEl.textContent = lista.length.toLocaleString('pt-BR');
    const totalValor = lista.reduce((a, item) => a + (config.valorTotal ? config.valorTotal(item) : 0), 0);
    if (valorEl) valorEl.textContent = moeda(totalValor);
    if (pendentesEl) pendentesEl.textContent = lista.filter(item => ['Pendente', 'Aberto', 'Em analise', 'Em andamento'].includes(item.status)).length.toLocaleString('pt-BR');
    renderTabelaAcertosViagem(config);
    renderResumoAcertoSelecionado();
    return;
  }

  const lista = getData(config.key);
  const tbody = $(config.table);
  const totalEl = $(config.total);
  const valorEl = $(config.valor);
  const pendentesEl = $(config.pendentes);

  if (totalEl) totalEl.textContent = lista.length.toLocaleString('pt-BR');
  const totalValor = lista.reduce((a, item) => a + (config.valorTotal ? config.valorTotal(item) : 0), 0);
  if (valorEl) valorEl.textContent = config.valorLabel ? config.valorLabel(totalValor) : moeda(totalValor);
  if (pendentesEl) pendentesEl.textContent = lista.filter(item => ['Pendente', 'Aberto', 'Em analise', 'Em andamento'].includes(item.status)).length.toLocaleString('pt-BR');

  if (!tbody) return;
  tbody.innerHTML = '';
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="${config.colunas.length}" class="text-center">Nenhum lancamento registrado.</td></tr>`;
    return;
  }

  lista.slice().reverse().slice(0, MAX_TABLE_ROWS).forEach(item => {
    const valores = config.montarLinha(item);
    const tr = document.createElement('tr');
    tr.innerHTML = valores.map((valor, index) => {
      const texto = escapeHtml(String(valor === null || valor === undefined || valor === '' ? '-' : valor));
      const isStatus = config.colunas[index] === 'Status';
      return `<td>${isStatus ? `<span class="badge ${badgeStatusOperacional(valor)}">${texto}</span>` : texto}</td>`;
    }).join('');
    tbody.appendChild(tr);
  });
}

function initModuloOperacional() {
  const config = MODULOS_OPERACIONAIS[document.body.id];
  if (!config) return;
  preencherCombosOperacionais();
  if (config.key === KEYS.ACERTOS) {
    initFiltrosAcertoViagem();
    if ($('formAcertoViagem')) {
      novoAcertoViagem(false);
      ['valorTonelada', 'toneladas', 'receita', 'despesas', 'adiantamento', 'kmInicial', 'kmFinal'].forEach(id => {
        const el = $(id);
        if (el && !el.dataset.summaryBound) {
          el.addEventListener('input', id === 'valorTonelada' || id === 'toneladas' ? atualizarFreteAcertoForm : renderResumoAcertoSelecionado);
          el.dataset.summaryBound = '1';
        }
      });
      ['ufCarregamento', 'ufDescarregamento'].forEach(id => {
        const el = $(id);
        if (el && !el.dataset.upperBound) {
          el.addEventListener('input', () => { el.value = el.value.toUpperCase().slice(0, 2); });
          el.dataset.upperBound = '1';
        }
      });
    }
  }
  renderModuloOperacional(config);
  if (config.key === KEYS.ACERTOS && $('formAcertoViagem')) {
    const acertoUrl = new URLSearchParams(window.location.search).get('id');
    if (acertoUrl) selecionarAcertoViagem(acertoUrl, { scroll: false });
    else renderTabelaLancamentosAcerto();
  }

  const form = $(config.form);
  if (form) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const item = coletarFormularioOperacional(config);
      const erro = validarFormularioOperacional(config, item);
      if (erro) {
        notificar(erro, 'error');
        return;
      }
      const lista = getData(config.key);
      const idx = lista.findIndex(registro => registro.id === item.id);
      if (idx >= 0) lista[idx] = { ...lista[idx], ...item, atualizadoEm: new Date().toISOString() };
      else lista.push(item);
      saveData(config.key, lista);
      limparFormularioOperacional(config);
      renderModuloOperacional(config);
      if (config.key === KEYS.ACERTOS) {
        if (document.body.id === 'acerto-viagem-detalhe-page') {
          window.history.replaceState({}, '', `acerto-viagem-detalhe.html?id=${encodeURIComponent(item.id)}`);
        }
        renderFluxoLancamentosAcerto();
        selecionarAcertoViagem(item.id, { scroll: false });
      }
      notificar(config.key === KEYS.ACERTOS ? 'Acerto salvo.' : 'Lancamento salvo.', 'success');
    });
  }

  document.querySelectorAll('[data-clear-operacional]').forEach(btn => {
    btn.addEventListener('click', () => limparFormularioOperacional(config));
  });
}

/* === FLUXO DE LANCAMENTOS DO ACERTO === */
function rotuloAcertoViagem(acerto) {
  if (!acerto) return 'Acerto nao vinculado';
  const periodo = [formatarDataDashboard(acerto.dataSaida), formatarDataDashboard(acerto.dataRetorno)]
    .filter(Boolean)
    .join(' a ');
  const rota = resumoRotaAcerto(acerto);
  return `${periodo || 'Sem periodo'} - ${acerto.motorista || '-'} - ${acerto.veiculo || '-'}${rota && rota !== '-' ? ` - ${rota}` : ''}`;
}

function preencherSelectAcertos(select) {
  if (!select) return;
  const atual = select.value;
  const acertos = getData(KEYS.ACERTOS).slice().reverse();
  select.innerHTML = '<option value="">Selecione o acerto</option>' + acertos.map(acerto => (
    `<option value="${escapeHtml(acerto.id)}">${escapeHtml(rotuloAcertoViagem(acerto))}</option>`
  )).join('');
  if (acertos.some(acerto => acerto.id === atual)) select.value = atual;
}

function nomeMotoristaUsuario(usuario = obterUsuarioLogado()) {
  const nome = usuario?.nome || usuario?.usuario || '';
  return motoristaCadastrado(nome) || nome;
}

function acertosDoMotorista(usuario = obterUsuarioLogado(), incluirFechados = false) {
  const motorista = normalizarChave(nomeMotoristaUsuario(usuario));
  const statusFechado = new Set(['CANCELADO', 'ENCERRADO', 'PAGO', 'FINALIZADO']);
  return getData(KEYS.ACERTOS)
    .filter(acerto => normalizarChave(acerto.motorista) === motorista)
    .filter(acerto => incluirFechados || !statusFechado.has(normalizarChave(acerto.status)))
    .sort((a, b) => String(b.dataSaida || b.criadoEm || '').localeCompare(String(a.dataSaida || a.criadoEm || '')));
}

function preencherSelectDriverAcertos(select, usuario = obterUsuarioLogado()) {
  if (!select) return;
  const atual = select.value;
  const acertos = acertosDoMotorista(usuario);
  select.innerHTML = '<option value="">Selecione o acerto aberto</option>' + acertos.map(acerto => (
    `<option value="${escapeHtml(acerto.id)}">${escapeHtml(rotuloAcertoViagem(acerto))}</option>`
  )).join('');
  if (acertos.some(acerto => acerto.id === atual)) select.value = atual;
}

function preencherDriverAcertos(usuario = obterUsuarioLogado()) {
  preencherSelectDriverAcertos($('driverLanAcerto'), usuario);
  preencherSelectDriverAcertos($('driverAdAcerto'), usuario);
}

function aplicarAcertoSelecionadoDriver(selectId, veiculoId) {
  const acerto = getData(KEYS.ACERTOS).find(item => item.id === getVal(selectId));
  if (!acerto) return;
  setVal(veiculoId, acerto.veiculo || '');
}

function arquivosDoInput(input) {
  if (!input?.files?.length) return [];
  return Array.from(input.files).map(file => ({
    nome: file.name,
    tipo: file.type || 'arquivo',
    tamanho: file.size || 0,
    previewUrl: URL.createObjectURL(file)
  }));
}

function nomesAnexosLancamento(item) {
  const anexos = Array.isArray(item.anexos) ? item.anexos : [];
  if (!anexos.length) return '-';
  return anexos.map(anexo => escapeHtml(anexo.nome || anexo)).join('<br>');
}

function statusLancamentoPendente(status) {
  return ['PENDENTE', 'EM ANALISE', 'ABERTO', 'EM ANDAMENTO'].includes(normalizarStatusLancamento(status));
}

function statusLancamentoAprovado(status) {
  return normalizarStatusLancamento(status) === 'APROVADO';
}

function statusLancamentoDevolvido(status) {
  return normalizarStatusLancamento(status) === 'DEVOLVIDO';
}

function normalizarStatusLancamento(status) {
  return String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function lancamentoEhAdiantamento(item) {
  const categoria = normalizarChave(item?.categoria || item?.descricao || '');
  return item?.tipo === 'Solicitacao' && categoria.includes('ADIANTAMENTO');
}

function tiposComValorNoAcerto(item) {
  return ['Despesa', 'Combustivel'].includes(item.tipo) || lancamentoEhAdiantamento(item);
}

function recalcularDespesasAprovadasAcertos() {
  const lancamentos = getData(KEYS.LANCAMENTOS_ACERTO);
  const acertos = getData(KEYS.ACERTOS);
  if (!acertos.length) return;
  const totaisPorAcerto = lancamentos.reduce((acc, item) => {
    if (!statusLancamentoAprovado(item.status) || !item.acertoId || !tiposComValorNoAcerto(item)) return acc;
    const campo = lancamentoEhAdiantamento(item) ? 'adiantamentos' : 'despesas';
    acc[campo][item.acertoId] = (acc[campo][item.acertoId] || 0) + asNumber(item.valor);
    return acc;
  }, { despesas: {}, adiantamentos: {} });
  const atualizados = acertos.map(acerto => ({
    ...acerto,
    origemDestino: acerto.origemDestino && acerto.origemDestino !== '-' ? acerto.origemDestino : (resumoRotaAcerto(acerto) === '-' ? '' : resumoRotaAcerto(acerto)),
    receita: calcularFreteAcerto(acerto),
    despesas: totaisPorAcerto.despesas[acerto.id] || 0,
    adiantamento: totaisPorAcerto.adiantamentos[acerto.id] || 0
  }));
  saveData(KEYS.ACERTOS, atualizados);
}

function sincronizarTipoLancamentoMotorista() {
  const categoria = normalizarChave(getVal('driverLanCategoria'));
  setVal('driverLanTipo', categoria === 'COMBUSTIVEL' ? 'Combustivel' : 'Despesa');
}

function criarLancamentoAcerto(origem, usuario = null) {
  const motoristaUsuario = usuario?.nome || usuario?.usuario || '';
  if (origem === 'motorista') {
    sincronizarTipoLancamentoMotorista();
    const acertoId = getVal('driverLanAcerto');
    const acerto = getData(KEYS.ACERTOS).find(item => item.id === acertoId);
    const correcaoDe = getVal('driverLanCorrecaoDe');
    const original = correcaoDe ? getData(KEYS.LANCAMENTOS_ACERTO).find(item => item.id === correcaoDe) : null;
    return {
      id: gerarId(),
      origem,
      acertoId,
      acertoLabel: acerto ? rotuloAcertoViagem(acerto) : '',
      tipo: getVal('driverLanTipo'),
      data: getVal('driverLanData'),
      motorista: motoristaCadastrado(motoristaUsuario) || motoristaUsuario,
      veiculo: acerto?.veiculo || placaCadastrada(getVal('driverLanVeiculo')) || getVal('driverLanVeiculo'),
      categoria: getVal('driverLanCategoria'),
      valor: asNumber(getVal('driverLanValor')),
      documento: getVal('driverLanDocumento'),
      descricao: getVal('driverLanDescricao'),
      anexos: arquivosDoInput($('driverLanAnexos')),
      correcaoDe,
      versao: original ? asNumber(original.versao || 1) + 1 : 1,
      status: 'Pendente',
      criadoEm: new Date().toISOString()
    };
  }

  if (origem === 'motorista-adiantamento') {
    const categoria = getVal('driverAdCategoria');
    const descricao = getVal('driverAdDescricao');
    const acertoId = getVal('driverAdAcerto');
    const acerto = getData(KEYS.ACERTOS).find(item => item.id === acertoId);
    const correcaoDe = getVal('driverAdCorrecaoDe');
    const original = correcaoDe ? getData(KEYS.LANCAMENTOS_ACERTO).find(item => item.id === correcaoDe) : null;
    return {
      id: gerarId(),
      origem,
      acertoId,
      acertoLabel: acerto ? rotuloAcertoViagem(acerto) : '',
      tipo: 'Solicitacao',
      data: getVal('driverAdData'),
      motorista: motoristaCadastrado(motoristaUsuario) || motoristaUsuario,
      veiculo: acerto?.veiculo || placaCadastrada(getVal('driverAdVeiculo')) || getVal('driverAdVeiculo'),
      categoria,
      valor: asNumber(getVal('driverAdValor')),
      documento: '',
      descricao: descricao || categoria,
      anexos: arquivosDoInput($('driverAdAnexos')),
      correcaoDe,
      versao: original ? asNumber(original.versao || 1) + 1 : 1,
      status: 'Pendente',
      criadoEm: new Date().toISOString()
    };
  }

  const acertoId = getVal('lanAcerto') || getVal('acertoId');
  const acerto = getData(KEYS.ACERTOS).find(item => item.id === acertoId);
  return {
    id: gerarId(),
    origem: 'operacional',
    acertoId,
    acertoLabel: acerto ? rotuloAcertoViagem(acerto) : '',
    tipo: getVal('lanTipo'),
    data: getVal('lanData'),
    motorista: motoristaCadastrado(getVal('lanMotorista')) || getVal('lanMotorista'),
    veiculo: placaCadastrada(getVal('lanVeiculo')) || getVal('lanVeiculo'),
    categoria: getVal('lanCategoria'),
    valor: asNumber(getVal('lanValor')),
    documento: getVal('lanDocumento'),
    descricao: getVal('lanDescricao'),
    anexos: arquivosDoInput($('lanAnexos')),
    status: 'Em analise',
    criadoEm: new Date().toISOString()
  };
}

function validarLancamentoAcerto(item) {
  if (!item.tipo || !item.data || !item.motorista) return 'Informe tipo, data e motorista.';
  if (String(item.origem || '').startsWith('motorista') && !item.acertoId) return 'Selecione o acerto da viagem antes de enviar.';
  if (String(item.origem || '').startsWith('motorista') && !item.veiculo) return 'Selecione o veiculo.';
  if (item.veiculo && !placaExisteCadastro(item.veiculo)) {
    const campoVeiculo = item.origem === 'motorista-adiantamento'
      ? $('driverAdVeiculo')
      : (item.origem === 'motorista' ? $('driverLanVeiculo') : $('lanVeiculo'));
    atualizarEstadoCampoPesquisavel(campoVeiculo);
    return `A placa ${item.veiculo} nao existe no cadastro de veiculos.`;
  }
  if (item.motorista && !motoristaExisteCadastro(item.motorista) && !String(item.origem || '').startsWith('motorista')) {
    atualizarEstadoCampoPesquisavel($('lanMotorista'));
    return `O motorista ${item.motorista} nao existe no cadastro de motoristas.`;
  }
  if (lancamentoEhAdiantamento(item) && asNumber(item.valor) <= 0) return 'Informe o valor do adiantamento.';
  if (item.tipo !== 'Solicitacao' && asNumber(item.valor) <= 0) return 'Informe o valor do lancamento.';
  if (item.tipo === 'Solicitacao' && !item.descricao && !item.categoria) return 'Descreva a solicitacao.';
  return '';
}

function salvarLancamentoAcerto(item) {
  const lista = getData(KEYS.LANCAMENTOS_ACERTO);
  if (item.correcaoDe) {
    const originalIdx = lista.findIndex(registro => registro.id === item.correcaoDe);
    if (originalIdx >= 0) {
      lista[originalIdx] = {
        ...lista[originalIdx],
        status: 'Substituido',
        corrigidoPor: item.id,
        atualizadoEm: new Date().toISOString()
      };
    }
  }
  lista.push(item);
  saveData(KEYS.LANCAMENTOS_ACERTO, lista);
  recalcularDespesasAprovadasAcertos();
  renderFluxoLancamentosAcerto();
}

function limparFormularioLancamentoAcerto(form) {
  if (form) form.reset();
  if ($('lanData')) $('lanData').value = new Date().toISOString().split('T')[0];
  if ($('lanAcerto')) $('lanAcerto').value = getVal('acertoId');
  if ($('driverLanData')) $('driverLanData').value = new Date().toISOString().split('T')[0];
  if ($('driverAdData')) $('driverAdData').value = new Date().toISOString().split('T')[0];
  setVal('driverLanCorrecaoDe', '');
  setVal('driverAdCorrecaoDe', '');
  sincronizarTipoLancamentoMotorista();
  preencherCombosOperacionais();
  preencherDriverAcertos();
}

function garantirGavetaAcerto() {
  let overlay = document.querySelector('.settlement-drawer-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'settlement-drawer-overlay';
  overlay.innerHTML = `
    <div class="settlement-drawer-backdrop" onclick="fecharGavetaAcerto()"></div>
    <aside class="settlement-drawer" role="dialog" aria-modal="true" aria-labelledby="settlementDrawerTitle">
      <header class="settlement-drawer-header">
        <div>${iconeLucide('receipt', '')}<strong id="settlementDrawerTitle">Lancamento</strong></div>
        <button type="button" class="filter-drawer-close" onclick="fecharGavetaAcerto()" aria-label="Fechar">${iconeLucide('x', 'X')}</button>
      </header>
      <div class="settlement-drawer-body" id="settlementDrawerBody"></div>
    </aside>
  `;
  document.body.appendChild(overlay);
  ativarIconesInterface();
  return overlay;
}

function fecharGavetaAcerto() {
  recolherFormularioLancamentoAcerto();
  document.querySelector('.settlement-drawer-overlay')?.classList.remove('is-open');
  document.body.classList.remove('settlement-drawer-open');
}

function recolherFormularioLancamentoAcerto() {
  const form = $('formLancamentoAcerto');
  const source = document.querySelector('.settlement-drawer-source');
  if (form && source && form.parentElement !== source) source.appendChild(form);
}

function prepararLancamentoPorTipo(tipo) {
  const acerto = acertoSelecionadoAtual();
  if ($('lanAcerto')) $('lanAcerto').value = acerto?.id || '';
  if (acerto) {
    setVal('lanMotorista', acerto.motorista || '');
    setVal('lanVeiculo', acerto.veiculo || '');
  }
  if ($('lanData') && !getVal('lanData')) $('lanData').value = new Date().toISOString().split('T')[0];

  const tipoNormalizado = String(tipo || 'Despesa');
  if (tipoNormalizado === 'Adiantamento') {
    setVal('lanTipo', 'Solicitacao');
    if ($('lanCategoria')) {
      $('lanCategoria').innerHTML = `
        <option>ADIANTAMENTO PARA ABASTECIMENTO</option>
        <option>ADIANTAMENTO PARA USO PROPRIO</option>
        <option>ADIANTAMENTO PARA MANUTENCAO EMERGENCIAL</option>
        <option>OUTRO ADIANTAMENTO</option>
      `;
    }
    setVal('lanDescricao', 'Solicitacao de adiantamento de viagem');
  } else {
    setVal('lanTipo', tipoNormalizado === 'Solicitacao' ? 'Solicitacao' : 'Despesa');
    if ($('lanCategoria')) {
      $('lanCategoria').innerHTML = `
        <option>Combustivel</option><option>Arla</option><option>Pedagio</option><option>Alimentacao</option>
        <option>Manutencao</option><option>Borracharia</option><option>Lavagem</option><option>Documento</option><option>Outros</option>
      `;
    }
  }
}

function abrirGavetaLancamentoAcerto(tipo = 'Despesa') {
  if (!getVal('acertoId')) {
    notificar('Salve ou abra um acerto antes de lancar despesas ou solicitacoes.', 'error');
    return;
  }
  recolherFormularioLancamentoAcerto();
  const form = $('formLancamentoAcerto');
  if (!form) return;
  const overlay = garantirGavetaAcerto();
  const body = $('settlementDrawerBody');
  const title = $('settlementDrawerTitle');
  prepararLancamentoPorTipo(tipo);
  if (title) title.textContent = tipo === 'Adiantamento' ? 'Solicitar adiantamento' : `Novo ${String(tipo).toLowerCase()}`;
  body.innerHTML = `
    <div class="settlement-drawer-intro">
      <span>${escapeHtml(rotuloAcertoViagem(acertoSelecionadoAtual()))}</span>
      <strong>${tipo === 'Adiantamento' ? 'Adiantamento entra no saldo do acerto apos aprovacao.' : 'O lancamento fica pendente ate a conferencia do escritorio.'}</strong>
    </div>
  `;
  body.appendChild(form);
  overlay.classList.add('is-open');
  document.body.classList.add('settlement-drawer-open');
  ativarIconesInterface();
  setTimeout(() => $('lanValor')?.focus(), 80);
}

function documentosDoAcerto(acertoId = getVal('acertoId')) {
  if (!acertoId) return [];
  return getData(KEYS.LANCAMENTOS_ACERTO)
    .filter(item => item.acertoId === acertoId && Array.isArray(item.anexos) && item.anexos.length)
    .flatMap(item => item.anexos.map((anexo, index) => ({ item, anexo, index })));
}

function abrirDocumentoLancamento(id, index) {
  const item = getData(KEYS.LANCAMENTOS_ACERTO).find(registro => registro.id === id);
  const anexo = item?.anexos?.[Number(index)];
  if (anexo?.previewUrl) {
    window.open(anexo.previewUrl, '_blank', 'noopener');
    return;
  }
  notificar('Este documento esta registrado como metadado. O upload definitivo entra na fase de storage.', 'info');
}

function renderDocumentosAcerto() {
  const box = $('documentosAcertoList');
  if (!box) return;
  const docs = documentosDoAcerto();
  if (!docs.length) {
    box.innerHTML = '<div class="ops-empty">Nenhum comprovante vinculado a este acerto.</div>';
    return;
  }
  box.innerHTML = docs.map(({ item, anexo, index }) => `
    <article class="settlement-document-item">
      <div>
        <strong>${escapeHtml(anexo.nome || 'Documento')}</strong>
        <span>${escapeHtml(tipoLancamentoLabel(item))} - ${escapeHtml(item.categoria || '-')} - ${moeda(item.valor)}</span>
      </div>
      <button type="button" class="btn-mini" onclick="abrirDocumentoLancamento('${escapeHtml(item.id)}','${index}')">Visualizar</button>
    </article>
  `).join('');
}

function abrirGavetaDocumentosAcerto() {
  if (!getVal('acertoId')) {
    notificar('Abra um acerto para consultar documentos.', 'error');
    return;
  }
  recolherFormularioLancamentoAcerto();
  const overlay = garantirGavetaAcerto();
  const body = $('settlementDrawerBody');
  const title = $('settlementDrawerTitle');
  if (title) title.textContent = 'Documentos do acerto';
  const docs = documentosDoAcerto();
  body.innerHTML = `
    <div class="settlement-drawer-intro">
      <span>${escapeHtml(rotuloAcertoViagem(acertoSelecionadoAtual()))}</span>
      <strong>${docs.length ? `${docs.length} comprovante(s) anexado(s).` : 'Nenhum comprovante anexado ainda.'}</strong>
    </div>
    <div class="settlement-documents-list">
      ${docs.length ? docs.map(({ item, anexo, index }) => `
        <article class="settlement-document-item">
          <div>
            <strong>${escapeHtml(anexo.nome || 'Documento')}</strong>
            <span>${escapeHtml(tipoLancamentoLabel(item))} - ${escapeHtml(item.categoria || '-')} - ${moeda(item.valor)}</span>
          </div>
          <button type="button" class="btn-mini" onclick="abrirDocumentoLancamento('${escapeHtml(item.id)}','${index}')">Visualizar</button>
        </article>
      `).join('') : '<div class="ops-empty">O motorista ainda nao anexou comprovantes neste acerto.</div>'}
    </div>
  `;
  overlay.classList.add('is-open');
  document.body.classList.add('settlement-drawer-open');
}

function dataHoraLancamento(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : data.toLocaleString('pt-BR');
}

function detalheLinhaLancamento(label, valor) {
  return `<div class="settlement-detail-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(valor || '-')}</strong></div>`;
}

function abrirDetalheLancamentoAcerto(id) {
  const item = getData(KEYS.LANCAMENTOS_ACERTO).find(registro => registro.id === id);
  if (!item) {
    notificar('Lancamento nao encontrado.', 'error');
    return;
  }

  recolherFormularioLancamentoAcerto();
  const overlay = garantirGavetaAcerto();
  const body = $('settlementDrawerBody');
  const title = $('settlementDrawerTitle');
  const pendente = statusLancamentoPendente(item.status);
  const anexos = Array.isArray(item.anexos) ? item.anexos : [];
  const acerto = item.acertoId
    ? getData(KEYS.ACERTOS).find(registro => registro.id === item.acertoId)
    : null;

  if (title) title.textContent = `Lancamento ${item.status || 'pendente'}`;
  body.innerHTML = `
    <div class="settlement-drawer-intro settlement-launch-intro">
      <span>${escapeHtml(tipoLancamentoLabel(item))} - ${escapeHtml(item.categoria || 'Sem categoria')}</span>
      <strong>${moeda(item.valor)} <small><span class="badge ${badgeStatusOperacional(item.status)}">${escapeHtml(item.status || '-')}</span></small></strong>
    </div>

    <section class="settlement-detail-card">
      <h3>Dados do lancamento</h3>
      <div class="settlement-detail-lines">
        ${detalheLinhaLancamento('Data', formatarDataDashboard(item.data))}
        ${detalheLinhaLancamento('Motorista', item.motorista)}
        ${detalheLinhaLancamento('Veiculo', item.veiculo)}
        ${detalheLinhaLancamento('Tipo', tipoLancamentoLabel(item))}
        ${detalheLinhaLancamento('Categoria', item.categoria)}
        ${detalheLinhaLancamento('Documento', item.documento)}
        ${detalheLinhaLancamento('Origem', item.origem === 'operacional' ? 'Escritorio' : 'Motorista')}
        ${detalheLinhaLancamento('Acerto / viagem', item.acertoLabel || (acerto ? rotuloAcertoViagem(acerto) : 'Sem vinculo'))}
      </div>
    </section>

    <section class="settlement-detail-card">
      <h3>Descricao e historico</h3>
      <p class="settlement-detail-description">${escapeHtml(item.descricao || 'Sem descricao informada.')}</p>
      <div class="settlement-detail-lines">
        ${detalheLinhaLancamento('Criado em', dataHoraLancamento(item.criadoEm))}
        ${detalheLinhaLancamento('Atualizado em', dataHoraLancamento(item.atualizadoEm))}
        ${item.aprovadoEm ? detalheLinhaLancamento('Aprovado em', dataHoraLancamento(item.aprovadoEm)) : ''}
        ${item.devolvidoEm ? detalheLinhaLancamento('Devolvido em', dataHoraLancamento(item.devolvidoEm)) : ''}
        ${item.canceladoEm ? detalheLinhaLancamento('Cancelado em', dataHoraLancamento(item.canceladoEm)) : ''}
        ${item.motivoDevolucao ? detalheLinhaLancamento('Motivo da correcao', item.motivoDevolucao) : ''}
        ${item.motivoCancelamento ? detalheLinhaLancamento('Motivo do cancelamento', item.motivoCancelamento) : ''}
      </div>
    </section>

    <section class="settlement-detail-card">
      <h3>Anexos</h3>
      <div class="settlement-documents-list">
        ${anexos.length ? anexos.map((anexo, index) => `
          <article class="settlement-document-item">
            <div>
              <strong>${escapeHtml(anexo.nome || anexo || 'Documento')}</strong>
              <span>${escapeHtml(anexo.tipo || 'arquivo')}</span>
            </div>
            <button type="button" class="btn-mini" onclick="abrirDocumentoLancamento('${escapeHtml(item.id)}','${index}')">Visualizar</button>
          </article>
        `).join('') : '<div class="ops-empty">Nenhum anexo neste lancamento.</div>'}
      </div>
    </section>

    <div class="settlement-detail-actions">
      <button type="button" class="btn btn-secondary" onclick="fecharGavetaAcerto()">Fechar</button>
      ${pendente ? `
        <button type="button" class="btn btn-primary" onclick="alterarStatusLancamentoAcerto('${escapeHtml(item.id)}','Aprovado'); abrirDetalheLancamentoAcerto('${escapeHtml(item.id)}')">Aprovar</button>
        <button type="button" class="btn btn-warning" onclick="alterarStatusLancamentoAcerto('${escapeHtml(item.id)}','Devolvido'); abrirDetalheLancamentoAcerto('${escapeHtml(item.id)}')">Voltar correcao</button>
        <button type="button" class="btn btn-secondary" onclick="alterarStatusLancamentoAcerto('${escapeHtml(item.id)}','Cancelado'); abrirDetalheLancamentoAcerto('${escapeHtml(item.id)}')">Cancelar</button>
      ` : ''}
    </div>
  `;

  overlay.classList.add('is-open');
  document.body.classList.add('settlement-drawer-open');
  ativarIconesInterface();
}

function acoesLancamentoHtml(item) {
  const id = escapeHtml(item.id);
  const status = normalizarStatusLancamento(item.status);
  const abrir = `<button type="button" class="btn-mini" onclick="abrirDetalheLancamentoAcerto('${id}')">Abrir</button>`;
  if (status === 'APROVADO') return `<div class="decision-actions is-readonly">${abrir}<span class="decision-note success">Aprovado</span></div>`;
  if (status === 'DEVOLVIDO') return `<div class="decision-actions is-readonly">${abrir}<span class="decision-note warning">Em correcao</span></div>`;
  if (status === 'SUBSTITUIDO') return `<div class="decision-actions is-readonly">${abrir}<span class="decision-note">Substituido</span></div>`;
  if (status === 'CANCELADO') return `<div class="decision-actions is-readonly">${abrir}<span class="decision-note danger">Cancelado</span></div>`;
  if (!statusLancamentoPendente(item.status)) return `<div class="decision-actions is-readonly">${abrir}<span class="decision-note">${escapeHtml(item.status || 'Registrado')}</span></div>`;
  return `<div class="decision-actions">
    ${abrir}
    <button type="button" class="btn-mini success" onclick="alterarStatusLancamentoAcerto('${id}','Aprovado')">Aprovar</button>
    <button type="button" class="btn-mini warning" onclick="alterarStatusLancamentoAcerto('${id}','Devolvido')">Voltar</button>
    <button type="button" class="btn-mini danger" onclick="alterarStatusLancamentoAcerto('${id}','Cancelado')">Cancelar</button>
  </div>`;
}

function tipoLancamentoLabel(item) {
  if (lancamentoEhAdiantamento(item)) return 'Adiantamento';
  return item.tipo || '-';
}

function descricaoLancamento(item) {
  const partes = [];
  if (item.categoria) partes.push(item.categoria);
  if (item.descricao && normalizarChave(item.descricao) !== normalizarChave(item.categoria)) partes.push(item.descricao);
  if (item.documento) partes.push(`Doc: ${item.documento}`);
  if (item.motivoDevolucao) partes.push(`Correcao solicitada: ${item.motivoDevolucao}`);
  if (item.motivoCancelamento) partes.push(`Cancelamento: ${item.motivoCancelamento}`);
  if (item.correcaoDe) partes.push('Reenvio corrigido pelo motorista');
  return partes.join(' | ') || '-';
}

function linhaBaseLancamento(item) {
  return {
    data: formatarDataDashboard(item.data),
    motorista: item.motorista || '-',
    veiculo: item.veiculo || '-',
    tipo: tipoLancamentoLabel(item),
    categoria: item.categoria || '-',
    documento: item.documento || '-',
    valor: moeda(item.valor),
    anexos: nomesAnexosLancamento(item),
    status: `<span class="badge ${badgeStatusOperacional(item.status)}">${escapeHtml(item.status || '-')}</span>`,
    acoes: acoesLancamentoHtml(item),
    descricao: descricaoLancamento(item)
  };
}

function renderTabelaLancamentosAcerto() {
  const tbody = $('tabelaLancamentosAcerto');
  renderTabelasDetalheAcerto();
  renderDocumentosAcerto();
  if (!tbody) return;
  const acertoAtual = getVal('acertoId');
  const lista = getData(KEYS.LANCAMENTOS_ACERTO)
    .filter(item => !acertoAtual || !item.acertoId || item.acertoId === acertoAtual)
    .slice()
    .reverse();
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum lancamento recebido.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.slice(0, MAX_TABLE_ROWS).map(item => {
    const l = linhaBaseLancamento(item);
    return `<tr>
      <td>${escapeHtml(l.data)}</td><td>${escapeHtml(l.motorista)}</td><td>${escapeHtml(l.veiculo)}</td>
      <td>${escapeHtml(l.tipo)}</td><td>${escapeHtml(l.categoria)}</td><td>${l.valor}</td>
      <td>${l.anexos}</td><td>${l.status}</td><td>${l.acoes}</td>
    </tr>`;
  }).join('');
}

function renderTabelasDetalheAcerto() {
  const despesasBody = $('tabelaDespesasAcerto');
  const solicitacoesBody = $('tabelaSolicitacoesAcerto');
  if (!despesasBody && !solicitacoesBody) return;

  const acertoAtual = getVal('acertoId');
  const lista = getData(KEYS.LANCAMENTOS_ACERTO)
    .filter(item => acertoAtual && item.acertoId === acertoAtual)
    .slice()
    .reverse();
  const despesas = lista.filter(item => item.tipo !== 'Solicitacao');
  const solicitacoes = lista.filter(item => item.tipo === 'Solicitacao');

  if (despesasBody) {
    despesasBody.innerHTML = despesas.length ? despesas.slice(0, MAX_TABLE_ROWS).map(item => {
      const l = linhaBaseLancamento(item);
      return `<tr>
        <td>${escapeHtml(l.data)}</td>
        <td>${escapeHtml(l.categoria)}</td>
        <td>${l.valor}</td>
        <td>${escapeHtml(l.documento)}</td>
        <td>${l.status}</td>
        <td>${l.acoes}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="text-center">Nenhuma despesa vinculada a este acerto.</td></tr>';
  }

  if (solicitacoesBody) {
    solicitacoesBody.innerHTML = solicitacoes.length ? solicitacoes.slice(0, MAX_TABLE_ROWS).map(item => {
      const l = linhaBaseLancamento(item);
      return `<tr>
        <td>${escapeHtml(l.data)}</td>
        <td>${escapeHtml(l.tipo)}</td>
        <td>${escapeHtml(l.descricao)}</td>
        <td>${l.valor}</td>
        <td>${l.status}</td>
        <td>${l.acoes}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="text-center">Nenhuma solicitacao vinculada a este acerto.</td></tr>';
  }
}

function renderTabelaDespesasLancamentos() {
  const tbody = $('tabelaDespesas');
  if (!tbody) return;
  const lista = getData(KEYS.LANCAMENTOS_ACERTO)
    .filter(item => item.tipo !== 'Solicitacao')
    .slice()
    .reverse();
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">Nenhuma despesa ou combustivel recebido.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.slice(0, MAX_TABLE_ROWS).map(item => {
    const l = linhaBaseLancamento(item);
    return `<tr>
      <td>${escapeHtml(l.data)}</td><td>${escapeHtml(l.motorista)}</td><td>${escapeHtml(l.veiculo)}</td>
      <td>${escapeHtml(l.tipo)}</td><td>${escapeHtml(l.categoria)}</td><td>${escapeHtml(l.documento)}</td>
      <td>${l.valor}</td><td>${l.anexos}</td><td>${l.status}</td><td>${l.acoes}</td>
    </tr>`;
  }).join('');
}

function renderTabelaSolicitacoesLancamentos() {
  const tbody = $('tabelaSolicitacoes');
  if (!tbody) return;
  const lista = getData(KEYS.LANCAMENTOS_ACERTO)
    .filter(item => item.tipo === 'Solicitacao')
    .slice()
    .reverse();
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhuma solicitacao recebida.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.slice(0, MAX_TABLE_ROWS).map(item => {
    const l = linhaBaseLancamento(item);
    return `<tr>
      <td>${escapeHtml(l.data)}</td><td>${escapeHtml(l.motorista)}</td><td>${escapeHtml(l.veiculo)}</td>
      <td>${escapeHtml(l.tipo)}</td><td>${escapeHtml(l.descricao)}</td><td>${l.valor}</td><td>${l.anexos}</td>
      <td>${l.status}</td><td>${l.acoes}</td>
    </tr>`;
  }).join('');
}

function renderKpisLancamentosAcerto() {
  const lista = getData(KEYS.LANCAMENTOS_ACERTO);
  const despesas = lista.filter(item => item.tipo !== 'Solicitacao');
  const solicitacoes = lista.filter(item => item.tipo === 'Solicitacao');
  const pendentes = lista.filter(item => statusLancamentoPendente(item.status)).length;
  const aprovadosValor = lista
    .filter(item => statusLancamentoAprovado(item.status) && tiposComValorNoAcerto(item))
    .reduce((total, item) => total + asNumber(item.valor), 0);

  if ($('lancamentoTotal')) $('lancamentoTotal').textContent = lista.length.toLocaleString('pt-BR');
  if ($('lancamentoPendentes')) $('lancamentoPendentes').textContent = pendentes.toLocaleString('pt-BR');
  if ($('lancamentoAprovados')) $('lancamentoAprovados').textContent = moeda(aprovadosValor);

  if ($('despesaTotal')) $('despesaTotal').textContent = despesas.length.toLocaleString('pt-BR');
  if ($('despesaValor')) $('despesaValor').textContent = moeda(despesas.filter(item => statusLancamentoAprovado(item.status)).reduce((total, item) => total + asNumber(item.valor), 0));
  if ($('despesaPendentes')) $('despesaPendentes').textContent = despesas.filter(item => statusLancamentoPendente(item.status)).length.toLocaleString('pt-BR');

  if ($('solicitacaoTotal')) $('solicitacaoTotal').textContent = solicitacoes.length.toLocaleString('pt-BR');
  if ($('solicitacaoPrioridade')) $('solicitacaoPrioridade').textContent = solicitacoes.filter(item => statusLancamentoDevolvido(item.status)).length.toLocaleString('pt-BR');
  if ($('solicitacaoPendentes')) $('solicitacaoPendentes').textContent = solicitacoes.filter(item => statusLancamentoPendente(item.status)).length.toLocaleString('pt-BR');
}

function renderDriverLancamentos(usuario) {
  const listaEl = $('driverLancamentosList');
  if (!listaEl) return;
  const motorista = normalizarChave(usuario?.nome || usuario?.usuario || '');
  const lista = getData(KEYS.LANCAMENTOS_ACERTO)
    .filter(item => normalizarChave(item.motorista) === motorista)
    .slice()
    .reverse();
  if (!lista.length) {
    listaEl.innerHTML = '<p class="driver-empty">Nenhum lancamento enviado.</p>';
    return;
  }
  listaEl.innerHTML = lista.slice(0, 12).map(item => {
    const label = tipoLancamentoLabel(item);
    const statusClass = badgeStatusOperacional(item.status);
    const devolvido = normalizarChave(item.status) === 'DEVOLVIDO';
    const motivo = item.motivoDevolucao ? `Correcao: ${item.motivoDevolucao}` : '';
    return `
      <article class="driver-history-item">
        <strong>${escapeHtml(label)} - ${moeda(item.valor)}</strong>
        <span>${escapeHtml(formatarDataDashboard(item.data))} | ${escapeHtml(item.categoria || '-')}</span>
        ${devolvido ? `<button type="button" class="driver-mini-action warning" onclick="corrigirLancamentoMotorista('${escapeHtml(item.id)}')">Corrigir</button>` : ''}
        <small><span class="badge ${statusClass}">${escapeHtml(item.status || '-')}</span> ${escapeHtml(motivo || item.descricao || item.documento || '')}</small>
      </article>
    `;
  }).join('');
}

function renderDriverAcertos(usuario) {
  const listaEl = $('driverAcertosList');
  if (!listaEl) return;
  const lista = acertosDoMotorista(usuario, true).slice(0, 10);
  if (!lista.length) {
    listaEl.innerHTML = '<p class="driver-empty">Nenhum acerto aberto ainda.</p>';
    return;
  }
  listaEl.innerHTML = lista.map(acerto => {
    const statusClass = badgeStatusOperacional(acerto.status);
    const devolvido = normalizarChave(acerto.status) === 'DEVOLVIDO';
    return `
      <article class="driver-history-item">
        <strong>Viagem ${escapeHtml(acerto.numeroViagem || '-')} - ${escapeHtml(acerto.veiculo || '-')}</strong>
        <span>${escapeHtml(formatarDataDashboard(acerto.dataSaida))} | ${escapeHtml(resumoRotaAcerto(acerto))}</span>
        ${devolvido ? `<button type="button" class="driver-mini-action warning" onclick="corrigirAcertoMotorista('${escapeHtml(acerto.id)}')">Corrigir</button>` : ''}
        <small><span class="badge ${statusClass}">${escapeHtml(acerto.status || '-')}</span> ${escapeHtml(acerto.motivoDevolucao || acerto.observacao || '')}</small>
      </article>
    `;
  }).join('');
}

function corrigirLancamentoMotorista(id) {
  const item = getData(KEYS.LANCAMENTOS_ACERTO).find(registro => registro.id === id);
  if (!item) return notificar('Lancamento nao encontrado.', 'error');
  const usuario = obterUsuarioLogado();
  preencherDriverAcertos(usuario);

  if (lancamentoEhAdiantamento(item)) {
    mostrarSecaoMotorista('adiantamentos');
    setVal('driverAdCorrecaoDe', item.id);
    setVal('driverAdAcerto', item.acertoId || '');
    setVal('driverAdCategoria', item.categoria || 'ADIANTAMENTO PARA ABASTECIMENTO');
    setVal('driverAdData', dataIsoCurta(item.data) || new Date().toISOString().split('T')[0]);
    setVal('driverAdVeiculo', item.veiculo || '');
    setVal('driverAdValor', item.valor || '');
    setVal('driverAdDescricao', item.descricao || '');
    $('formDriverAdiantamento')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    mostrarSecaoMotorista('frota');
    setVal('driverLanCorrecaoDe', item.id);
    setVal('driverLanAcerto', item.acertoId || '');
    setVal('driverLanTipo', item.tipo || 'Despesa');
    setVal('driverLanData', dataIsoCurta(item.data) || new Date().toISOString().split('T')[0]);
    setVal('driverLanVeiculo', item.veiculo || '');
    setVal('driverLanCategoria', item.categoria || 'Outros');
    setVal('driverLanValor', item.valor || '');
    setVal('driverLanDocumento', item.documento || '');
    setVal('driverLanDescricao', item.descricao || '');
    $('formDriverLancamento')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  notificar('Revise os dados, anexe o comprovante e envie novamente.', 'info');
}

function criarAcertoMotorista(usuario) {
  const motorista = motoristaCadastrado(usuario?.nome || usuario?.usuario || '') || usuario?.nome || usuario?.usuario || '';
  const veiculo = placaCadastrada(getVal('driverAcertoVeiculo')) || getVal('driverAcertoVeiculo');
  const dataSaida = getVal('driverAcertoDataSaida');
  const correcaoId = getVal('driverAcertoCorrecaoId');
  if (!veiculo || !dataSaida) return 'Informe veiculo e data de inicio.';
  if (veiculo && !placaExisteCadastro(veiculo)) {
    atualizarEstadoCampoPesquisavel($('driverAcertoVeiculo'));
    return `A placa ${veiculo} nao existe no cadastro de veiculos.`;
  }

  const item = {
    id: correcaoId || gerarId(),
    origem: 'motorista',
    numeroViagem: proximoNumeroViagem(),
    dataSaida,
    dataRetorno: '',
    dataAcerto: new Date().toISOString().split('T')[0],
    motorista,
    veiculo,
    localCarregamento: getVal('driverAcertoCarregamento'),
    ufCarregamento: '',
    localDescarregamento: getVal('driverAcertoDescarregamento'),
    ufDescarregamento: '',
    valorTonelada: getVal('driverAcertoValorTonelada'),
    toneladas: getVal('driverAcertoToneladas'),
    kmInicial: '',
    kmFinal: '',
    mediaLitrosKm: '',
    despesas: 0,
    adiantamento: 0,
    motivoDevolucao: '',
    status: 'Em analise',
    observacao: correcaoId ? 'Correcao reenviada pelo motorista' : 'Aberto pelo motorista',
    criadoEm: new Date().toISOString()
  };
  item.origemDestino = resumoRotaAcerto(item);
  item.receita = calcularFreteAcerto(item);

  const lista = getData(KEYS.ACERTOS);
  if (correcaoId) {
    const idx = lista.findIndex(acerto => acerto.id === correcaoId);
    if (idx < 0) return 'Acerto original nao encontrado para correcao.';
    lista[idx] = {
      ...lista[idx],
      ...item,
      id: correcaoId,
      numeroViagem: lista[idx].numeroViagem || item.numeroViagem,
      dataRetorno: lista[idx].dataRetorno || item.dataRetorno,
      kmInicial: lista[idx].kmInicial || item.kmInicial,
      kmFinal: lista[idx].kmFinal || item.kmFinal,
      mediaLitrosKm: lista[idx].mediaLitrosKm || item.mediaLitrosKm,
      despesas: lista[idx].despesas || item.despesas,
      adiantamento: lista[idx].adiantamento || item.adiantamento,
      criadoEm: lista[idx].criadoEm || item.criadoEm,
      atualizadoEm: new Date().toISOString()
    };
  } else {
    lista.push(item);
  }
  saveData(KEYS.ACERTOS, lista);
  return '';
}

function limparCorrecaoAcertoMotorista() {
  setVal('driverAcertoCorrecaoId', '');
  const botao = document.querySelector('#formDriverNovoAcerto .driver-submit');
  if (botao) botao.textContent = 'Abrir acerto';
}

function initFormDriverNovoAcerto(usuario) {
  const form = $('formDriverNovoAcerto');
  if (!form) return;
  if ($('driverAcertoDataSaida') && !getVal('driverAcertoDataSaida')) {
    $('driverAcertoDataSaida').value = new Date().toISOString().split('T')[0];
  }
  if (form.dataset.bound) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const erro = criarAcertoMotorista(usuario);
    if (erro) return notificar(erro, 'error');
    form.reset();
    limparCorrecaoAcertoMotorista();
    if ($('driverAcertoDataSaida')) $('driverAcertoDataSaida').value = new Date().toISOString().split('T')[0];
    preencherCombosOperacionais();
    preencherDriverAcertos(usuario);
    renderDriverAcertos(usuario);
    notificar('Acerto enviado para conferencia do escritorio.', 'success');
  });
  form.dataset.bound = '1';
}

function corrigirAcertoMotorista(id) {
  const acerto = getData(KEYS.ACERTOS).find(item => item.id === id);
  if (!acerto) return notificar('Acerto nao encontrado.', 'error');
  mostrarSecaoMotorista('frota');
  setVal('driverAcertoCorrecaoId', acerto.id);
  setVal('driverAcertoVeiculo', acerto.veiculo || '');
  setVal('driverAcertoDataSaida', acerto.dataSaida || '');
  setVal('driverAcertoCarregamento', acerto.localCarregamento || '');
  setVal('driverAcertoDescarregamento', acerto.localDescarregamento || '');
  setVal('driverAcertoValorTonelada', acerto.valorTonelada || '');
  setVal('driverAcertoToneladas', acerto.toneladas || '');
  const botao = document.querySelector('#formDriverNovoAcerto .driver-submit');
  if (botao) botao.textContent = 'Reenviar correcao';
  $('formDriverNovoAcerto')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderFluxoLancamentosAcerto(usuario = null) {
  preencherCombosOperacionais();
  preencherDriverAcertos(usuario || obterUsuarioLogado());
  recalcularDespesasAprovadasAcertos();
  renderTabelaLancamentosAcerto();
  renderTabelaDespesasLancamentos();
  renderTabelaSolicitacoesLancamentos();
  renderKpisLancamentosAcerto();
  if (usuario) {
    renderDriverLancamentos(usuario);
    renderDriverAcertos(usuario);
  }
  const config = MODULOS_OPERACIONAIS[document.body.id];
  if (config?.key === KEYS.ACERTOS) renderModuloOperacional(config);
}

function alterarStatusLancamentoAcerto(id, status) {
  const lista = getData(KEYS.LANCAMENTOS_ACERTO);
  const idx = lista.findIndex(item => item.id === id);
  if (idx < 0) return;
  const atual = lista[idx];
  const acertoAtual = getVal('acertoId');
  const acertoParaVincular = status === 'Aprovado' && !atual.acertoId
    ? (acertoAtual ? acertoSelecionadoAtual() : encontrarAcertoCompativelLancamento(atual))
    : null;
  if (status === 'Aprovado' && tiposComValorNoAcerto(atual) && !atual.acertoId && !acertoParaVincular) {
    notificar('Abra ou selecione um acerto compativel antes de aprovar este valor.', 'error');
    return;
  }
  const vinculoAcerto = acertoParaVincular
    ? { acertoId: acertoParaVincular.id, acertoLabel: rotuloAcertoViagem(acertoParaVincular) }
    : {};
  const extras = {};
  if (status === 'Devolvido') {
    const motivo = prompt('Informe o que o motorista precisa corrigir neste lancamento:');
    if (motivo === null) return;
    const texto = motivo.trim();
    if (!texto) return notificar('Informe o motivo para devolver ao motorista.', 'error');
    extras.motivoDevolucao = texto;
    extras.devolvidoEm = new Date().toISOString();
  }
  if (status === 'Cancelado') {
    const motivo = prompt('Motivo do cancelamento (opcional):');
    if (motivo === null) return;
    extras.motivoCancelamento = motivo.trim();
    extras.canceladoEm = new Date().toISOString();
  }
  if (status === 'Aprovado') {
    extras.motivoDevolucao = '';
    extras.aprovadoEm = new Date().toISOString();
  }
  lista[idx] = { ...atual, ...vinculoAcerto, ...extras, status, atualizadoEm: new Date().toISOString() };
  saveData(KEYS.LANCAMENTOS_ACERTO, lista);
  recalcularDespesasAprovadasAcertos();
  const selecionado = getVal('acertoId');
  if (selecionado) preencherAcertoNoFormulario(getData(KEYS.ACERTOS).find(item => item.id === selecionado));
  renderFluxoLancamentosAcerto();
  const complemento = status === 'Aprovado' && !lista[idx].acertoId
    ? ' Sem acerto aberto compativel para vincular automaticamente.'
    : '';
  notificar(`Lancamento ${status.toLowerCase()}.${complemento}`, status === 'Aprovado' ? 'success' : 'info');
}

function initFormLancamentoAcerto() {
  const form = $('formLancamentoAcerto');
  if (!form) return;
  if ($('lanData') && !getVal('lanData')) $('lanData').value = new Date().toISOString().split('T')[0];
  if ($('lanAcerto') && !$('lanAcerto').dataset.bound) {
    $('lanAcerto').addEventListener('change', () => {
      const acerto = getData(KEYS.ACERTOS).find(item => item.id === getVal('lanAcerto'));
      if (acerto) {
        setVal('lanMotorista', acerto.motorista);
        setVal('lanVeiculo', acerto.veiculo);
      }
    });
    $('lanAcerto').dataset.bound = '1';
  }
  if (form.dataset.bound) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const item = criarLancamentoAcerto('operacional');
    const erro = validarLancamentoAcerto(item);
    if (erro) return notificar(erro, 'error');
    salvarLancamentoAcerto(item);
    limparFormularioLancamentoAcerto(form);
    fecharGavetaAcerto();
    notificar('Lancamento enviado para analise.', 'success');
  });
  form.dataset.bound = '1';
}

function initFormDriverLancamento(usuario) {
  const form = $('formDriverLancamento');
  if (!form) return;
  if ($('driverLanData') && !getVal('driverLanData')) $('driverLanData').value = new Date().toISOString().split('T')[0];
  sincronizarTipoLancamentoMotorista();
  if ($('driverLanAcerto') && !$('driverLanAcerto').dataset.bound) {
    $('driverLanAcerto').addEventListener('change', () => aplicarAcertoSelecionadoDriver('driverLanAcerto', 'driverLanVeiculo'));
    $('driverLanAcerto').dataset.bound = '1';
  }
  if (form.dataset.bound) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const item = criarLancamentoAcerto('motorista', usuario);
    const erro = validarLancamentoAcerto(item);
    if (erro) return notificar(erro, 'error');
    salvarLancamentoAcerto(item);
    limparFormularioLancamentoAcerto(form);
    renderDriverLancamentos(usuario);
    renderDriverAcertos(usuario);
    mostrarSecaoMotorista('historico');
    notificar('Despesa enviada para o escritorio.', 'success');
  });
  form.dataset.bound = '1';
}

function initFormDriverAdiantamento(usuario) {
  const form = $('formDriverAdiantamento');
  if (!form) return;
  if ($('driverAdData') && !getVal('driverAdData')) $('driverAdData').value = new Date().toISOString().split('T')[0];
  if ($('driverAdAcerto') && !$('driverAdAcerto').dataset.bound) {
    $('driverAdAcerto').addEventListener('change', () => aplicarAcertoSelecionadoDriver('driverAdAcerto', 'driverAdVeiculo'));
    $('driverAdAcerto').dataset.bound = '1';
  }
  if (form.dataset.bound) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const item = criarLancamentoAcerto('motorista-adiantamento', usuario);
    const erro = validarLancamentoAcerto(item);
    if (erro) return notificar(erro, 'error');
    salvarLancamentoAcerto(item);
    limparFormularioLancamentoAcerto(form);
    renderDriverLancamentos(usuario);
    renderDriverAcertos(usuario);
    mostrarSecaoMotorista('historico');
    notificar('Solicitacao de adiantamento enviada.', 'success');
  });
  form.dataset.bound = '1';
}

function initFluxoLancamentosAcerto(usuario = null) {
  initFormLancamentoAcerto();
  renderFluxoLancamentosAcerto(usuario);
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
  prepararCamposPesquisaveis();

  const recursosPorPagina = {
    'dashboard-page': [],
    'motoristas-page': ['motoristas'],
    'veiculos-page': ['veiculos', 'motoristas', 'pneus'],
    'pneus-page': ['pneus', 'movimentacoes', 'veiculos'],
    'movimentacao-page': ['pneus', 'movimentacoes', 'veiculos'],
    'acerto-viagem-page': ['veiculos', 'motoristas'],
    'acerto-viagem-detalhe-page': ['veiculos', 'motoristas'],
    'manutencao-page': ['veiculos', 'motoristas'],
    'despesas-page': ['veiculos', 'motoristas'],
    'solicitacoes-page': ['veiculos', 'motoristas'],
    'relatorios-page': ['pneus', 'movimentacoes', 'veiculos', 'motoristas'],
    'financeiro-page': ['veiculos', 'motoristas'],
    'motorista-app-page': ['pneus', 'movimentacoes', 'veiculos'],
    'configuracoes-page': []
  };
  const paginasSomenteLocal = new Set([
    'acerto-viagem-page',
    'acerto-viagem-detalhe-page',
    'manutencao-page',
    'despesas-page',
    'solicitacoes-page',
    'financeiro-page',
    'relatorios-page'
  ]);
  const modoLocal = paginasSomenteLocal.has(document.body.id);
  window.modoFinanceiroLocal = modoLocal;
  window.dadosBancoProntos = modoLocal
    ? Promise.resolve()
    : sincronizarDadosBanco(recursosPorPagina[document.body.id]);
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
  // Modulos operacionais
  initModuloOperacional();
  // Fluxo de acerto e lancamentos
  initFluxoLancamentosAcerto(usuarioLogado);
  // Painel de pneus
  if ($('totalPneus') || $('graficoStatus')) { atualizarDashboard(); gerarGraficosDashboard(); }
  // Relatórios
  if ($('relatorios-page')) gerarRelatorios();
  // Area do motorista
  if ($('motorista-app-page')) initMotoristaApp(usuarioLogado);
  // Configuracoes
  if ($('configuracoes-page')) initConfiguracoes(usuarioLogado);
});


