/* ============================================================
   EXECUTIVA - RELATÓRIOS AVANÇADOS (reports.js)
   CPK, Por Pneu, Por Marca, Por Veículo
   Fórmula: CPK = (Valor Compra + Recapagens + Consertos) ÷ KM Rodado
============================================================ */

// ---- HELPERS ----
const $r = id => document.getElementById(id);
const getDataR = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const numR = v => Number(v) || 0;
const moedaR = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const kmFmt = v => v > 0 ? Number(v).toLocaleString('pt-BR') + ' km' : '-';
function cpkFmtR(v, sufixo = true) {
  const n = numR(v);
  const casas = n < 0.01 ? 4 : 3;
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: 4 })}${sufixo ? '/km' : ''}`;
}
const MAX_REL_ROWS = 300;

function custoPneuR(pneu) {
  return numR(pneu.valorCompra) + getCustoRecapagens(pneu.numPneu, pneu);
}

function dataMovR(mov) {
  return mov.dataMov || mov.data_movimentacao || '';
}

function anosMovsR(movs) {
  const anos = [...new Set(movs.map(dataMovR)
    .filter(Boolean)
    .map(d => String(d).slice(0, 4))
    .filter(a => /^\d{4}$/.test(a)))]
    .sort((a, b) => Number(b) - Number(a));
  return anos.length ? anos : [String(new Date().getFullYear())];
}

function tipoMovR(mov) {
  return mov.tipoMov || mov.tipo_movimentacao || '';
}

// Cache da tabela de recapagens/custos
let _recapagensCache = null;
function getRecapagens() {
  if (!_recapagensCache) _recapagensCache = getDataR('recapagens_custos');
  return _recapagensCache;
}
function clearRecapCache() { _recapagensCache = null; }

/**
 * Calcula o custo total de recapagens/consertos de um pneu.
 * Busca na nova tabela 'recapagens_custos' e também no campo legado 'recapagens' do pneu.
 */
function getCustoRecapagens(numPneu, pneu) {
  if (Object.prototype.hasOwnProperty.call(pneu, 'custoRecapagens')) return numR(pneu.custoRecapagens);
  // Busca na nova tabela separada
  const recapsTbl = getRecapagens().filter(r => r.id_pneu === numPneu);
  if (recapsTbl.length > 0) {
    return recapsTbl.reduce((a, r) => a + numR(r.valor), 0);
  }
  // Fallback: campo legado dentro do objeto pneu
  return (pneu.recapagens || []).reduce((a, r) => a + numR(r.valor), 0);
}

/**
 * Calcula o CPK de um pneu.
 * CPK = (Valor de Compra + Total de Recapagens/Consertos) ÷ Quilometragem Rodada
 */
function calcCpk(pneu) {
  const custoRecapes = getCustoRecapagens(pneu.numPneu, pneu);
  const custoTotal = numR(pneu.valorCompra) + custoRecapes;
  const km = numR(pneu.kmRodadoTotal);
  return km > 0 && custoTotal > 0 ? custoTotal / km : null;
}

/**
 * Exibe badge colorido de CPK.
 * Referência para pneus pesados: Bom < R$0,05/km, Regular até R$0,10/km, Alto custo > R$0,10/km
 */
function badgeCpk(cpk) {
  if (cpk === null) return '<span style="color:#94a3b8">Sem dados</span>';
  if (cpk <= 0.05) return `<span class="badge-cpk-bom">${cpkFmtR(cpk)}</span>`;
  if (cpk <= 0.10) return `<span class="badge-cpk-med">${cpkFmtR(cpk)}</span>`;
  return `<span class="badge-cpk-ruim">${cpkFmtR(cpk)}</span>`;
}

function grafBar(id, labels, data, cor, label) {
  const ctx = $r(id); if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInst) ctx._chartInst.destroy();
  ctx._chartInst = new Chart(ctx, {
    type: 'bar', data: {
      labels, datasets: [{
        label: label || '', data, backgroundColor: cor || 'rgba(26,122,58,0.7)',
        borderColor: (cor || '#1a7a3a'), borderWidth: 1, borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { font: { family: 'Inter' } } }, x: { ticks: { font: { family: 'Inter' }, maxRotation: 45 } } },
      plugins: { legend: { display: false } }
    }
  });
}

function grafPizza(id, labels, data, cores) {
  const ctx = $r(id); if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInst) ctx._chartInst.destroy();
  ctx._chartInst = new Chart(ctx, {
    type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: cores, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 14, font: { size: 11, family: 'Inter' } } } } }
  });
}

function grafMovPeriodo(id, labels, data, titulo) {
  const ctx = $r(id); if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInst) ctx._chartInst.destroy();
  const media = data.length ? data.reduce((a, n) => a + n, 0) / data.length : 0;
  ctx._chartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Movimentações',
          data,
          backgroundColor: 'rgba(21,115,71,0.78)',
          borderColor: '#157347',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 42
        },
        {
          type: 'line',
          label: 'Média',
          data: data.map(() => +media.toFixed(2)),
          borderColor: '#c58a12',
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
        y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'Inter' } } },
        x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }
      },
      plugins: {
        title: { display: !!titulo, text: titulo, font: { family: 'Inter', size: 14, weight: 'bold' } },
        legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Inter' } } }
      }
    }
  });
}

// ---- MARCAS ----
function calcMarcas(pneus) {
  const map = {};
  pneus.forEach(p => {
    const m = p.marca || 'Marca nao informada';
    if (!map[m]) map[m] = { qtd: 0, ativos: 0, baixados: 0, totalValor: 0, totalRecape: 0, totalCustoComKm: 0, totalKm: 0, qtdComKm: 0 };
    const s = map[m];
    const km = numR(p.kmRodadoTotal);
    const custo = custoPneuR(p);
    s.qtd++;
    s.totalValor += numR(p.valorCompra);
    s.totalRecape += getCustoRecapagens(p.numPneu, p);
    if (p.statusAtual === 'Rodando') s.ativos++;
    if (p.statusAtual === 'Baixado') s.baixados++;
    if (km > 0 && custo > 0) { s.totalKm += km; s.totalCustoComKm += custo; s.qtdComKm++; }
  });
  return Object.entries(map).map(([marca, s]) => ({
    marca, qtd: s.qtd, ativos: s.ativos, baixados: s.baixados,
    totalInvestido: s.totalValor + s.totalRecape,
    mediaKm: s.qtdComKm > 0 ? Math.round(s.totalKm / s.qtdComKm) : 0,
    cpkMedio: (s.qtdComKm > 0 && s.totalCustoComKm > 0) ? s.totalCustoComKm / s.totalKm : null
  })).sort((a, b) => b.totalInvestido - a.totalInvestido);
}

function renderRelMarca(pneus) {
  const marcas = calcMarcas(pneus);
  if (!marcas.length) { ['m-tabelaMarcas', 'm-rankingCpk'].forEach(id => { if ($r(id)) $r(id).innerHTML = '<div class="no-data">Sem dados cadastrados.</div>'; }); return; }

  // Tabela
  const tb = $r('m-tabelaMarcas');
  if (tb) {
    tb.innerHTML = '';
    marcas.forEach((m, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}º</td><td><strong>${m.marca}</strong></td><td>${m.qtd}</td>
        <td>${moedaR(m.totalInvestido)}</td>
        <td>${m.mediaKm > 0 ? m.mediaKm.toLocaleString('pt-BR') + ' km' : '-'}</td>
        <td>${m.cpkMedio ? cpkFmtR(m.cpkMedio) : '-'}</td>
        <td><span class="badge badge-success">${m.ativos}</span></td>
        <td><span class="badge badge-danger">${m.baixados}</span></td>`;
      tb.appendChild(tr);
    });
  }

  // Ranking CPK
  const rankDiv = $r('m-rankingCpk');
  if (rankDiv) {
    const comCpk = marcas.filter(m => m.cpkMedio !== null).sort((a, b) => a.cpkMedio - b.cpkMedio);
    if (!comCpk.length) { rankDiv.innerHTML = '<div class="no-data">Baixe pneus para gerar CPK.</div>'; }
    else {
      rankDiv.innerHTML = comCpk.map((m, i) => {
        const cls = i === 0 ? 'ouro' : i === 1 ? 'prata' : i === 2 ? 'bronze' : '';
        return `<div class="ranking-item">
          <div class="ranking-pos ${cls}">${i + 1}</div>
          <div class="ranking-info"><strong>${m.marca}</strong><span>${m.qtd} pneus · ${kmFmt(m.mediaKm)}</span></div>
          <div class="ranking-val">${badgeCpk(m.cpkMedio)}</div>
        </div>`;
      }).join('');
    }
  }

  // Gráficos
  grafBar('m-graficoCusto', marcas.map(m => m.marca), marcas.map(m => m.totalInvestido), 'rgba(212,160,23,0.75)', 'Investimento');
  grafBar('m-graficoKm', marcas.map(m => m.marca), marcas.map(m => m.mediaKm), 'rgba(26,122,58,0.75)', 'Média KM');
  const comCpk = marcas.filter(m => m.cpkMedio !== null).sort((a, b) => a.cpkMedio - b.cpkMedio);
  if (comCpk.length) grafBar('m-graficoCpk', comCpk.map(m => m.marca), comCpk.map(m => +m.cpkMedio.toFixed(4)), 'rgba(59,130,246,0.7)', 'CPK R$/km');
}

// ---- POR PNEU ----
function renderRelPneu(pneus) {
  // Popular filtro de marcas
  const selMarca = $r('p-filtroMarca');
  if (selMarca && selMarca.options.length <= 1) {
    const marcas = [...new Set(pneus.map(p => p.marca))].sort();
    marcas.forEach(m => { const o = document.createElement('option'); o.value = o.text = m; selMarca.appendChild(o); });
  }

  const fNum = ($r('p-filtroNum')?.value || '').toLowerCase();
  const fMarca = $r('p-filtroMarca')?.value || '';
  const fStatus = $r('p-filtroStatus')?.value || '';

  const filtrados = pneus.filter(p =>
    (!fNum || (p.numPneu || '').toLowerCase().includes(fNum)) &&
    (!fMarca || p.marca === fMarca) &&
    (!fStatus || p.statusAtual === fStatus)
  );
  const exibidos = filtrados.slice(0, MAX_REL_ROWS);

  const tb = $r('p-tabelaPneus');
  if (!tb) return;
  tb.innerHTML = '';
  if (!filtrados.length) { tb.innerHTML = '<tr><td colspan="10" class="no-data">Nenhum pneu encontrado.</td></tr>'; return; }

  exibidos.forEach(p => {
    const cpk = calcCpk(p);
    const custoTotal = custoPneuR(p);
    const bc = p.statusAtual === 'Rodando' ? 'badge-success' : p.statusAtual === 'Estoque' ? 'badge-warning' : p.statusAtual === 'Baixado' ? 'badge-danger' : 'badge-purple';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${p.numPneu}</strong></td><td>${p.marca}</td><td>${p.modelo || '-'}</td>
      <td><span class="badge ${bc}">${p.statusAtual}</span></td>
      <td>${p.veiculoAtual || '-'}</td>
      <td>${moedaR(custoTotal)}</td>
      <td>${kmFmt(p.kmRodadoTotal)}</td>
      <td>${badgeCpk(cpk)}</td>
      <td>${numR(p.quantidadeRecapagens) || (p.recapagens || []).length}</td>
      <td>${p.profundidadeAtual ? p.profundidadeAtual + ' mm' : '-'}</td>`;
    tb.appendChild(tr);
  });
  if (filtrados.length > exibidos.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="10" class="no-data">Mostrando ${exibidos.length} de ${filtrados.length}. Use os filtros para localizar um pneu especifico.</td>`;
    tb.appendChild(tr);
  }
}

// ---- POR MOTORISTAS ----
function renderRelMotorista(pneus, veiculos) {
  const motoristasData = getDataR('motoristas');
  const filt = ($r('mot-filtro')?.value || '').toLowerCase();

  // Agrupar dados por motorista
  const map = {};

  // Inicializa mapa com motoristas cadastrados
  motoristasData.forEach(m => {
    map[m.nome] = { nome: m.nome, veiculos: new Set(), pneus: [], custo: 0, kmTotal: 0, qtdComKm: 0 };
  });

  // Associa pneus e custos aos motoristas através do veículo
  pneus.forEach(p => {
    if (p.statusAtual === 'Rodando' && p.veiculoAtual && p.veiculoAtual !== '-') {
      const vInfo = veiculos.find(v => v.placa === p.veiculoAtual);
      if (vInfo && vInfo.motorista && map[vInfo.motorista]) {
        const mData = map[vInfo.motorista];
        mData.veiculos.add(p.veiculoAtual);
        mData.pneus.push(p);
        mData.custo += custoPneuR(p);
      }
    } else if (p.statusAtual === 'Baixado' && numR(p.kmRodadoTotal) > 0 && p.veiculoAtual) {
      // Para pneus baixados, tenta pegar o veículo de baixa (se tivermos essa info, no momento p.veiculoAtual é '-')
      // Simplificação: pega custos e km de pneus ativos por motorista no momento
    }
  });

  const lista = Object.values(map).filter(m => (!filt || m.nome.toLowerCase().includes(filt)) && m.pneus.length > 0);

  // Tabela por motorista
  const tb = $r('mot-tabela');
  if (tb) {
    tb.innerHTML = '';
    if (!lista.length) { tb.innerHTML = '<tr><td colspan="6" class="no-data">Sem dados para os motoristas (vincule um motorista a um veículo ativo).</td></tr>'; }
    else lista.forEach(m => {
      const cpkPneus = m.pneus.filter(p => numR(p.kmRodadoTotal) > 0 && numR(p.valorCompra) > 0);
      const cpkMedio = cpkPneus.length ? cpkPneus.reduce((a, p) => a + calcCpk(p), 0) / cpkPneus.length : null;

      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${m.nome}</strong></td>
        <td>${[...m.veiculos].join(', ') || '-'}</td>
        <td><span class="badge badge-success">${m.pneus.length}</span></td>
        <td>${moedaR(m.custo)}</td>
        <td>-</td>
        <td>${cpkMedio ? cpkFmtR(cpkMedio) : '-'}</td>`;
      tb.appendChild(tr);
    });
  }

  // Gráficos
  if (lista.length) {
    grafBar('mot-graficoVeiculos', lista.map(m => m.nome), lista.map(m => m.veiculos.size), 'rgba(26,122,58,0.75)', 'Qtd Veículos');
    grafBar('mot-graficoCusto', lista.map(m => m.nome), lista.map(m => m.custo), 'rgba(212,160,23,0.75)', 'Custo Total');
  }
}

// ---- POR VEÍCULO ----
function renderRelCaminhao(pneus, veiculos) {
  const filt = ($r('c-filtroVeiculo')?.value || '').toLowerCase();

  // Agrupa pneus por veículo
  const map = {};
  pneus.filter(p => p.statusAtual === 'Rodando' && p.veiculoAtual && p.veiculoAtual !== '-').forEach(p => {
    const v = p.veiculoAtual;
    if (!map[v]) map[v] = { placa: v, pneus: [], custo: 0, marcas: new Set() };
    map[v].pneus.push(p);
    map[v].custo += custoPneuR(p);
    map[v].marcas.add(p.marca);
  });

  const lista = Object.values(map).filter(v => !filt || v.placa.toLowerCase().includes(filt));

  // Tabela por veículo
  const tb = $r('c-tabelaVeiculos');
  if (tb) {
    tb.innerHTML = '';
    if (!lista.length) { tb.innerHTML = '<tr><td colspan="6" class="no-data">Sem veículos com pneus ativos.</td></tr>'; }
    else lista.forEach(v => {
      const infoVeiculo = veiculos.find(x => x.placa === v.placa);
      const cpkPneus = v.pneus.filter(p => numR(p.kmRodadoTotal) > 0 && numR(p.valorCompra) > 0);
      const cpkMedio = cpkPneus.length ? cpkPneus.reduce((a, p) => a + calcCpk(p), 0) / cpkPneus.length : null;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${v.placa}</strong></td>
        <td>${infoVeiculo?.tipo || '-'}</td>
        <td><span class="badge badge-success">${v.pneus.length}</span></td>
        <td>${[...v.marcas].join(', ')}</td>
        <td>${moedaR(v.custo)}</td>
        <td>${cpkMedio ? cpkFmtR(cpkMedio) : '-'}</td>`;
      tb.appendChild(tr);
    });
  }

  // Select de veículo para detalhe
  const sel = $r('c-selectVeiculo');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione um veículo...</option>';
    Object.keys(map).forEach(placa => { const o = document.createElement('option'); o.value = o.text = placa; sel.appendChild(o); });
    sel.onchange = () => renderPneusVeiculo(pneus, sel.value);
  }

  // Gráficos
  if (lista.length) {
    grafBar('c-graficoVeiculos', lista.map(v => v.placa), lista.map(v => v.pneus.length), 'rgba(26,122,58,0.75)', 'Pneus');
    grafBar('c-graficoCusto', lista.map(v => v.placa), lista.map(v => v.custo), 'rgba(212,160,23,0.75)', 'Custo');
  }
}

function renderPneusVeiculo(pneus, placa) {
  const tb = $r('c-pneusVeiculo'); if (!tb) return;
  tb.innerHTML = '';
  const f = pneus.filter(p => p.veiculoAtual === placa);
  if (!f.length) { tb.innerHTML = '<tr><td colspan="6" class="no-data">Sem pneus neste veículo.</td></tr>'; return; }
  f.forEach(p => {
    const bc = p.statusAtual === 'Rodando' ? 'badge-success' : 'badge-warning';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${p.numPneu}</strong></td><td>${p.marca}</td>
      <td>${p.localAtual || '-'}</td><td><span class="badge ${bc}">${p.statusAtual}</span></td>
      <td>${p.profundidadeAtual ? p.profundidadeAtual + ' mm' : '-'}</td><td>${moedaR(p.valorCompra)}</td>`;
    tb.appendChild(tr);
  });
}

// ---- CPK DETALHADO ----
function renderRelCpk(pneus) {
  const todos = pneus.filter(p => custoPneuR(p) > 0);
  const comCpk = todos.map(p => ({ ...p, _cpk: calcCpk(p) })).filter(p => p._cpk !== null);

  // KPIs
  if (comCpk.length) {
    const totalCustoCpk = comCpk.reduce((a, p) => a + custoPneuR(p), 0);
    const totalKmCpk = comCpk.reduce((a, p) => a + numR(p.kmRodadoTotal), 0);
    const med = totalKmCpk > 0 ? totalCustoCpk / totalKmCpk : 0;
    if ($r('cpk-medio')) $r('cpk-medio').textContent = cpkFmtR(med);

    const marcasCpk = {};
    comCpk.forEach(p => {
      if (!marcasCpk[p.marca]) marcasCpk[p.marca] = { custo: 0, km: 0 };
      marcasCpk[p.marca].custo += custoPneuR(p);
      marcasCpk[p.marca].km += numR(p.kmRodadoTotal);
    });
    const arr = Object.entries(marcasCpk).map(([m, s]) => ({ marca: m, cpk: s.custo / s.km })).sort((a, b) => a.cpk - b.cpk);
    if (arr.length) {
      if ($r('cpk-melhorMarca')) $r('cpk-melhorMarca').textContent = arr[0].marca + ' (' + cpkFmtR(arr[0].cpk, false) + ')';
      if ($r('cpk-piorMarca')) $r('cpk-piorMarca').textContent = arr[arr.length - 1].marca + ' (' + cpkFmtR(arr[arr.length - 1].cpk, false) + ')';
      grafBar('cpk-graficoCpkMarca', arr.map(a => a.marca), arr.map(a => +a.cpk.toFixed(4)), 'rgba(59,130,246,0.7)', 'CPK R$/km');
    }

    const topKm = [...comCpk].sort((a, b) => numR(b.kmRodadoTotal) - numR(a.kmRodadoTotal)).slice(0, 10);
    if ($r('cpk-maiorKm')) $r('cpk-maiorKm').textContent = kmFmt(topKm[0]?.kmRodadoTotal || 0);
    grafBar('cpk-graficoKmPneu', topKm.map(p => p.numPneu), topKm.map(p => p.kmRodadoTotal), 'rgba(26,122,58,0.7)', 'KM Rodado');
  } else {
    if ($r('cpk-medio')) $r('cpk-medio').textContent = 'R$ 0,00';
    if ($r('cpk-melhorMarca')) $r('cpk-melhorMarca').textContent = '-';
    if ($r('cpk-piorMarca')) $r('cpk-piorMarca').textContent = '-';
    if ($r('cpk-maiorKm')) $r('cpk-maiorKm').textContent = '0 km';
  }

  // Tabela CPK individual
  function renderTabelaCpk() {
    const busca = ($r('cpk-filtro')?.value || '').toLowerCase();
    const ordem = $r('cpk-ordenar')?.value || 'cpk-asc';
    let lista = todos.filter(p => !busca || p.numPneu.toLowerCase().includes(busca) || p.marca.toLowerCase().includes(busca));
    lista = lista.map(p => ({ ...p, _cpk: calcCpk(p) }));
    if (ordem === 'cpk-asc') lista.sort((a, b) => (a._cpk ?? 99999) - (b._cpk ?? 99999));
    else if (ordem === 'cpk-desc') lista.sort((a, b) => (b._cpk ?? -1) - (a._cpk ?? -1));
    else if (ordem === 'km-desc') lista.sort((a, b) => numR(b.kmRodadoTotal) - numR(a.kmRodadoTotal));
    else if (ordem === 'custo-desc') lista.sort((a, b) => custoPneuR(b) - custoPneuR(a));

    const tb = $r('cpk-tabela'); if (!tb) return;
    tb.innerHTML = '';
    if (!lista.length) { tb.innerHTML = '<tr><td colspan="8" class="no-data">Nenhum pneu encontrado.</td></tr>'; return; }
    const exibidos = lista.slice(0, MAX_REL_ROWS);
    exibidos.forEach(p => {
      const custoTotal = custoPneuR(p);
      const bc = p.statusAtual === 'Rodando' ? 'badge-success' : p.statusAtual === 'Estoque' ? 'badge-warning' : p.statusAtual === 'Baixado' ? 'badge-danger' : 'badge-purple';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${p.numPneu}</strong></td><td>${p.marca}</td>
        <td><span class="badge ${bc}">${p.statusAtual}</span></td>
        <td>${moedaR(custoTotal)}</td>
        <td>${kmFmt(p.kmRodadoTotal)}</td>
        <td>${badgeCpk(p._cpk)}</td>
        <td>${numR(p.quantidadeRecapagens) || (p.recapagens || []).length}</td>
        <td>${p._cpk !== null ? (p._cpk <= 0.05 ? 'Otimo' : p._cpk <= 0.10 ? 'Regular' : 'Alto custo') : 'S/ dados'}</td>`;
      tb.appendChild(tr);
    });
    if (lista.length > exibidos.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" class="no-data">Mostrando ${exibidos.length} de ${lista.length}. Use a busca para localizar um pneu especifico.</td>`;
      tb.appendChild(tr);
    }
  }

  renderTabelaCpk();
  if ($r('cpk-filtro')) $r('cpk-filtro').addEventListener('input', renderTabelaCpk);
  if ($r('cpk-ordenar')) $r('cpk-ordenar').addEventListener('change', renderTabelaCpk);
}

// ---- VISÃO GERAL ----
function renderRelGeral(pneus, movs) {
  const pneusComKm = pneus.filter(p => numR(p.kmRodadoTotal) > 0);
  const mediaKm = pneusComKm.length ? Math.round(pneusComKm.reduce((a, p) => a + numR(p.kmRodadoTotal), 0) / pneusComKm.length) : 0;
  const totalInv = pneus.reduce((a, p) => a + custoPneuR(p), 0);
  const pneusComCpk = pneus.filter(p => calcCpk(p) !== null);
  const cpkKm = pneusComCpk.reduce((a, p) => a + numR(p.kmRodadoTotal), 0);
  const cpkCusto = pneusComCpk.reduce((a, p) => a + custoPneuR(p), 0);
  const cpkMedio = cpkKm > 0 ? cpkCusto / cpkKm : 0;

  const set = (id, v) => { if ($r(id)) $r(id).textContent = v; };
  set('g-totalPneus', pneus.length);
  set('g-rodando', pneus.filter(p => p.statusAtual === 'Rodando').length);
  set('g-estoque', pneus.filter(p => p.statusAtual === 'Estoque').length);
  set('g-baixados', pneus.filter(p => p.statusAtual === 'Baixado').length);
  set('g-investido', moedaR(totalInv));
  set('g-mediaKm', kmFmt(mediaKm));
  set('g-cpkMedio', cpkMedio ? cpkFmtR(cpkMedio) : 'R$ 0,00');
  set('g-movs', movs.length);

  const r = pneus.filter(p => p.statusAtual === 'Rodando').length, e = pneus.filter(p => p.statusAtual === 'Estoque').length;
  const b = pneus.filter(p => p.statusAtual === 'Baixado').length, rc = pneus.filter(p => p.statusAtual === 'Recapado').length;
  grafPizza('g-graficoStatus', ['Rodando', 'Estoque', 'Baixados', 'Recapados'], [r, e, b, rc], ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6']);

  const marcasCount = {}; pneus.forEach(p => { marcasCount[p.marca] = (marcasCount[p.marca] || 0) + 1; });
  grafBar('g-graficoMarcas', Object.keys(marcasCount), Object.values(marcasCount), 'rgba(26,122,58,0.7)', 'Pneus');

  renderRelMovimentacoesPeriodo(movs);

  const tipos = {}; pneus.forEach(p => { tipos[p.tipo || 'Sem tipo'] = (tipos[p.tipo || 'Sem tipo'] || 0) + 1; });
  grafPizza('g-graficoTipos', Object.keys(tipos), Object.values(tipos), ['#1a7a3a', '#d4a017', '#3b82f6', '#ef4444', '#8b5cf6']);
}

function popularFiltrosRelMovimentacoes(movs) {
  const anoSelect = $r('relMovAno');
  if (!anoSelect) return;
  const anos = anosMovsR(movs);
  const atual = anoSelect.value;
  anoSelect.innerHTML = anos.map(ano => `<option value="${ano}">${ano}</option>`).join('');
  anoSelect.value = anos.includes(atual) ? atual : anos[0];
}

function renderRelMovimentacoesPeriodo(movs) {
  const canvas = $r('g-graficoMovs');
  if (!canvas || typeof Chart === 'undefined') return;
  popularFiltrosRelMovimentacoes(movs);

  const periodo = $r('relMovPeriodo')?.value || 'mensal';
  const ano = $r('relMovAno')?.value || anosMovsR(movs)[0];
  const tipo = $r('relMovTipo')?.value || '';
  const anoSelect = $r('relMovAno');
  if (anoSelect) anoSelect.style.display = periodo === 'mensal' ? '' : 'none';

  const filtrados = movs.filter(m => !tipo || tipoMovR(m) === tipo);
  let labels = [];
  let data = [];

  if (periodo === 'anual') {
    labels = anosMovsR(filtrados).sort((a, b) => Number(a) - Number(b));
    data = labels.map(labelAno => filtrados.filter(m => String(dataMovR(m)).slice(0, 4) === labelAno).length);
  } else {
    labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    data = labels.map((_, idx) => filtrados.filter(m => {
      const d = String(dataMovR(m));
      return d.slice(0, 4) === ano && Number(d.slice(5, 7)) === idx + 1;
    }).length);
  }

  const total = data.reduce((a, n) => a + n, 0);
  const media = data.length ? total / data.length : 0;
  const pico = Math.max(0, ...data);
  const picoIdx = data.indexOf(pico);
  if ($r('relMovTotal')) $r('relMovTotal').textContent = total.toLocaleString('pt-BR');
  if ($r('relMovMedia')) $r('relMovMedia').textContent = media.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if ($r('relMovPico')) $r('relMovPico').textContent = pico > 0 ? `${labels[picoIdx]} (${pico})` : '-';

  const titulo = periodo === 'anual'
    ? `Movimentações por Ano${tipo ? ` - ${tipo}` : ''}`
    : `Movimentações por Mês - ${ano}${tipo ? ` - ${tipo}` : ''}`;
  grafMovPeriodo('g-graficoMovs', labels, data, titulo);
}

// ---- INIT RELATÓRIOS ----
function initRelatorios() {
  // Limpa cache para garantir dados frescos
  clearRecapCache();

  const pneus = getDataR('pneus');
  const movs = getDataR('movimentacoes');
  const veiculos = getDataR('veiculos');

  // Controle das abas de relatório
  document.querySelectorAll('.rel-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rel-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.rel-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-rel');
      if ($r(target)) $r(target).classList.add('active');
      // Limpa cache e re-renderiza ao trocar de aba
      clearRecapCache();
      if (target === 'rel-marca') renderRelMarca(pneus);
      if (target === 'rel-pneu') renderRelPneu(pneus);
      if (target === 'rel-caminhao') renderRelCaminhao(pneus, veiculos);
      if (target === 'rel-cpk') renderRelCpk(pneus);
      if (target === 'rel-motorista') renderRelMotorista(pneus, veiculos);
    });
  });

  // Filtros
  ['p-filtroNum', 'p-filtroMarca', 'p-filtroStatus'].forEach(id => {
    if ($r(id)) $r(id).addEventListener('input', () => renderRelPneu(pneus));
    if ($r(id)) $r(id).addEventListener('change', () => renderRelPneu(pneus));
  });
  if ($r('c-filtroVeiculo')) $r('c-filtroVeiculo').addEventListener('input', () => renderRelCaminhao(pneus, veiculos));
  if ($r('mot-filtro')) $r('mot-filtro').addEventListener('input', () => renderRelMotorista(pneus, veiculos));
  ['relMovPeriodo', 'relMovAno', 'relMovTipo'].forEach(id => {
    if ($r(id)) $r(id).addEventListener('change', () => renderRelMovimentacoesPeriodo(movs));
  });

  // Renderiza geral inicialmente
  renderRelGeral(pneus, movs);
}

// Aguarda DOM e Chart.js
document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('relatorios-page')) {
    if (window.dadosBancoProntos) await window.dadosBancoProntos;
    if (typeof Chart !== 'undefined') initRelatorios();
    else {
      // Chart.js pode ainda estar carregando
      window.addEventListener('load', initRelatorios);
    }
  }
});
