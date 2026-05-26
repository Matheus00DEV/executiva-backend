(function () {
  if (window.Chart) {
    document.documentElement.dataset.chartEngine = 'chartjs';
    return;
  }
  document.documentElement.dataset.chartEngine = 'fallback';

  const instances = new WeakMap();
  const palette = ['#1a7a3a', '#d4a017', '#ef4444', '#3b82f6', '#8b5cf6', '#f97316', '#14b8a6'];

  function resolveCanvas(target) {
    if (!target) return null;
    if (target instanceof HTMLCanvasElement) return target;
    if (target.canvas instanceof HTMLCanvasElement) return target.canvas;
    return null;
  }

  function colorsFor(dataset, total) {
    const source = dataset.backgroundColor || dataset.borderColor || palette;
    const list = Array.isArray(source) ? source : [source];
    return Array.from({ length: total }, (_, index) => list[index % list.length] || palette[index % palette.length]);
  }

  function fitCanvas(canvas) {
    const parent = canvas.parentElement;
    const width = Math.max(260, parent ? parent.clientWidth : canvas.clientWidth || 320);
    const height = Math.max(220, parent ? parent.clientHeight : canvas.clientHeight || 240);
    const ratio = window.devicePixelRatio || 1;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width, height };
  }

  function clear(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.lineWidth = 2;
  }

  function drawNoData(ctx, width, height) {
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Sem dados para exibir', width / 2, height / 2);
  }

  function drawLegend(ctx, labels, colors, width, height) {
    const maxItems = Math.min(labels.length, 8);
    const startY = height - Math.ceil(maxItems / 2) * 20 - 4;
    const colWidth = width / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '11px Inter, Arial, sans-serif';
    for (let i = 0; i < maxItems; i++) {
      const x = 16 + (i % 2) * colWidth;
      const y = startY + Math.floor(i / 2) * 20;
      ctx.fillStyle = colors[i];
      ctx.fillRect(x, y - 5, 10, 10);
      ctx.fillStyle = '#475569';
      const text = String(labels[i] || '-').slice(0, 22);
      ctx.fillText(text, x + 16, y);
    }
  }

  function drawDoughnut(ctx, chart, width, height) {
    const labels = chart.data.labels || [];
    const dataset = (chart.data.datasets || [])[0] || {};
    const values = (dataset.data || []).map(Number);
    const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0);
    if (!total) return drawNoData(ctx, width, height);

    const colors = colorsFor(dataset, values.length);
    const cx = width / 2;
    const cy = Math.max(85, (height - 64) / 2);
    const radius = Math.max(48, Math.min(width, height - 70) * 0.34);
    let angle = -Math.PI / 2;

    values.forEach((value, index) => {
      const slice = (Math.max(value, 0) / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[index];
      ctx.fill();
      angle += slice;
    });

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 18px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total.toLocaleString('pt-BR'), cx, cy);
    drawLegend(ctx, labels, colors, width, height);
  }

  function drawAxes(ctx, left, top, right, bottom) {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();
  }

  function drawBar(ctx, chart, width, height) {
    const labels = chart.data.labels || [];
    const dataset = (chart.data.datasets || [])[0] || {};
    const values = (dataset.data || []).map(Number);
    if (!values.length || values.every(v => !v)) return drawNoData(ctx, width, height);

    const left = 44;
    const right = width - 16;
    const top = 20;
    const bottom = height - 42;
    const max = Math.max(...values, 1);
    const gap = 8;
    const barWidth = Math.max(12, ((right - left) / values.length) - gap);
    const colors = colorsFor(dataset, values.length);

    drawAxes(ctx, left, top, right, bottom);
    ctx.font = '10px Inter, Arial, sans-serif';
    values.forEach((value, index) => {
      const h = (Math.max(value, 0) / max) * (bottom - top);
      const x = left + index * ((right - left) / values.length) + gap / 2;
      const y = bottom - h;
      ctx.fillStyle = colors[index];
      ctx.fillRect(x, y, barWidth, h);
      if (labels.length <= 10) {
        ctx.save();
        ctx.translate(x + barWidth / 2, bottom + 14);
        ctx.rotate(-0.4);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#64748b';
        ctx.fillText(String(labels[index] || '').slice(0, 12), 0, 0);
        ctx.restore();
      }
    });
  }

  function drawLine(ctx, chart, width, height) {
    const labels = chart.data.labels || [];
    const dataset = (chart.data.datasets || [])[0] || {};
    const values = (dataset.data || []).map(Number);
    if (!values.length || values.every(v => !v)) return drawNoData(ctx, width, height);

    const left = 44;
    const right = width - 20;
    const top = 18;
    const bottom = height - 38;
    const max = Math.max(...values, 1);
    const color = dataset.borderColor || '#1a7a3a';
    const step = values.length > 1 ? (right - left) / (values.length - 1) : 0;

    drawAxes(ctx, left, top, right, bottom);
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = left + step * index;
      const y = bottom - (Math.max(value, 0) / max) * (bottom - top);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    values.forEach((value, index) => {
      const x = left + step * index;
      const y = bottom - (Math.max(value, 0) / max) * (bottom - top);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    if (labels.length <= 8) {
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      labels.forEach((label, index) => {
        ctx.fillText(String(label || '').slice(0, 8), left + step * index, bottom + 18);
      });
    }
  }

  class SimpleChart {
    constructor(target, config) {
      this.canvas = resolveCanvas(target);
      this.config = config || {};
      this.data = this.config.data || {};
      this.type = this.config.type || 'bar';
      if (!this.canvas) return;
      this.canvas.dataset.chartRendered = this.type;
      instances.set(this.canvas, this);
      this.render();
    }

    render() {
      const size = fitCanvas(this.canvas);
      clear(size.ctx, size.width, size.height);
      if (this.type === 'doughnut' || this.type === 'pie') drawDoughnut(size.ctx, this, size.width, size.height);
      else if (this.type === 'line') drawLine(size.ctx, this, size.width, size.height);
      else drawBar(size.ctx, this, size.width, size.height);
    }

    update() {
      this.render();
    }

    destroy() {
      if (!this.canvas) return;
      const size = fitCanvas(this.canvas);
      clear(size.ctx, size.width, size.height);
      instances.delete(this.canvas);
    }

    static getChart(target) {
      return instances.get(resolveCanvas(target));
    }
  }

  window.Chart = SimpleChart;
})();
