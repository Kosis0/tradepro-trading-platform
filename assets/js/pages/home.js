(() => {
  "use strict";

  const T = window.TP;
  const MD = window.MarketData;
  if (!T || !MD) return;

  const { $, $$ } = T;

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const CLASS_LABEL = { forex: "Forex", stocks: "Stocks", indices: "Indices", commodities: "Commodities", crypto: "Crypto" };

  function hexToRgba(hex, alpha) {
    let h = hex.trim();
    if (h.startsWith("#")) h = h.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return `rgba(30,92,70,${alpha})`;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function prepCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(40, Math.round(rect.width));
    const h = Math.max(40, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function drawSeries(canvas, points) {
    if (!canvas || !points || points.length < 2) return;
    const { ctx, w, h } = prepCanvas(canvas);
    let min = Infinity;
    let max = -Infinity;
    points.forEach((p) => { if (p < min) min = p; if (p > max) max = p; });
    const padY = (max - min) * 0.18 || Math.abs(max * 0.002) || 1;
    const lo = min - padY;
    const hi = max + padY;
    const px = (i) => 2 + (i / (points.length - 1)) * (w - 4);
    const py = (v) => h - 5 - ((v - lo) / (hi - lo)) * (h - 10);

    ctx.clearRect(0, 0, w, h);

    const border = cssVar("--border");
    if (border) {
      ctx.strokeStyle = border;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const y = (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    const rising = points[points.length - 1] >= points[0];
    const color = rising ? cssVar("--up") : cssVar("--down");

    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(px(0), py(p)) : ctx.lineTo(px(i), py(p))));
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hexToRgba(color, 0.22));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.save();
    ctx.lineTo(px(points.length - 1), h);
    ctx.lineTo(px(0), h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(px(0), py(p)) : ctx.lineTo(px(i), py(p))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px(points.length - 1), py(points[points.length - 1]), 3.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function flash(el, dir) {
    if (!el) return;
    el.classList.remove("price-flash-up", "price-flash-down");
    void el.offsetWidth;
    el.classList.add(dir >= 0 ? "price-flash-up" : "price-flash-down");
  }

  function chgBadge(id) {
    const pct = MD.changePct(id);
    const cls = pct >= 0 ? "badge-up" : "badge-down";
    return `<span class="badge ${cls} num">${T.fmtPct(pct)}</span>`;
  }

  function navigate(id) {
    window.location.href = `trade.html?symbol=${encodeURIComponent(id)}`;
  }

  const heroState = {
    id: "EURUSD",
    points: [],
    lastPrice: null
  };

  function initHero() {
    const nameEl = $("#live-symbol-name");
    const subEl = document.querySelector(".live-title small");
    const inst = MD.get(heroState.id)?.inst;
    if (!inst) return;
    nameEl.textContent = inst.symbol;
    subEl.textContent = inst.name;

    heroState.points = MD.history(heroState.id, 3600, 90).candles.map((c) => c.close);

    const miniIds = ["XAUUSD", "BTCUSD", "AAPL"];
    const wrap = $("#live-minis");
    wrap.innerHTML = miniIds.map((id) => {
      const i = MD.get(id)?.inst;
      if (!i) return "";
      return `
        <div class="mini-row" data-mini="${id}" role="button" tabindex="0" aria-label="Open ${T.escapeHtml(i.name)} in the terminal">
          <span class="m-sym">${T.escapeHtml(i.symbol)}<small>${CLASS_LABEL[i.cls]}</small></span>
          <span class="m-price num" data-mprice="${id}">—</span>
          <span class="m-chg num" data-mchg="${id}">—</span>
        </div>`;
    }).join("");

    wrap.addEventListener("click", (e) => {
      const row = e.target.closest("[data-mini]");
      if (row) navigate(row.dataset.mini);
    });
    wrap.addEventListener("keydown", (e) => {
      const row = e.target.closest("[data-mini]");
      if (row && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        navigate(row.dataset.mini);
      }
    });

    paintHero();
    drawSpark();
  }

  function paintHero() {
    const id = heroState.id;
    const price = MD.priceOf(id);
    const pct = MD.changePct(id);
    const abs = MD.change(id);
    const priceEl = $("#live-price");
    const chgEl = $("#live-change");
    if (!priceEl) return;

    if (heroState.lastPrice !== null && price !== heroState.lastPrice) {
      flash(priceEl, price - heroState.lastPrice);
    }
    heroState.lastPrice = price;

    priceEl.textContent = MD.fmtPrice(id, price);
    chgEl.className = `badge ${pct >= 0 ? "badge-up" : "badge-down"} num`;
    chgEl.textContent = `${abs >= 0 ? "+" : "\u2212"}${MD.fmtPrice(id, Math.abs(abs))} (${T.fmtPct(pct)})`;

    miniIds().forEach((mid) => {
      const pEl = document.querySelector(`[data-mprice="${mid}"]`);
      const cEl = document.querySelector(`[data-mchg="${mid}"]`);
      if (!pEl) return;
      pEl.textContent = MD.fmtPrice(mid, MD.priceOf(mid));
      const cp = MD.changePct(mid);
      cEl.textContent = T.fmtPct(cp);
      cEl.className = `m-chg num ${cp >= 0 ? "positive" : "negative"}`;
    });
  }

  function miniIds() {
    return ["XAUUSD", "BTCUSD", "AAPL"];
  }

  function drawSpark() {
    drawSeries($("#live-spark"), heroState.points);
  }

  function buildTicker() {
    const track = $("#ticker-track");
    if (!track) return;
    const item = (inst) => {
      const pct = MD.changePct(inst.id);
      const cls = pct >= 0 ? "positive" : "negative";
      return `
        <span class="tick-item" data-tick="${inst.id}">
          <b>${T.escapeHtml(inst.symbol)}</b>
          <span class="t-price num" data-tick-price>${MD.fmtPrice(inst.id, MD.priceOf(inst.id))}</span>
          <span class="${cls} num" data-tick-chg>${T.fmtPct(pct)}</span>
        </span>`;
    };
    const half = MD.INSTRUMENTS.map(item).join("");
    track.innerHTML = half + half;
  }

  function updateTicker() {
    MD.INSTRUMENTS.forEach((inst) => {
      const nodes = $$(`[data-tick="${inst.id}"]`);
      if (!nodes.length) return;
      const price = MD.fmtPrice(inst.id, MD.priceOf(inst.id));
      const pct = T.fmtPct(MD.changePct(inst.id));
      const cls = MD.changePct(inst.id) >= 0 ? "positive" : "negative";
      nodes.forEach((n) => {
        n.querySelector("[data-tick-price]").textContent = price;
        const c = n.querySelector("[data-tick-chg]");
        c.textContent = pct;
        c.className = `${cls} num`;
      });
    });
  }

  const TABLE_IDS = ["EURUSD", "GBPUSD", "XAUUSD", "WTI", "BTCUSD", "AAPL", "NVDA", "SPX"];

  function buildTable() {
    const body = $("#home-market-body");
    if (!body) return;
    body.innerHTML = TABLE_IDS.map((id) => {
      const inst = MD.get(id)?.inst;
      if (!inst) return "";
      const pct = MD.changePct(id);
      return `
        <tr data-row="${id}" tabindex="0" aria-label="Trade ${T.escapeHtml(inst.name)}">
          <td><strong>${T.escapeHtml(inst.symbol)}</strong><br><small class="muted">${T.escapeHtml(inst.name)}</small></td>
          <td><span class="badge badge-neutral">${CLASS_LABEL[inst.cls]}</span></td>
          <td class="cell-num num" data-cell="price">${MD.fmtPrice(id, MD.priceOf(id))}</td>
          <td class="cell-num">${chgBadge(id)}</td>
          <td class="cell-num num muted">${MD.fmtPrice(id, MD.get(id).high)} / ${MD.fmtPrice(id, MD.get(id).low)}</td>
          <td class="cell-num num muted sr-only-mob" data-cell="vol">${MD.volumeLabel(id)}</td>
          <td class="cell-num"><a class="btn btn-secondary btn-sm" href="trade.html?symbol=${id}">Trade</a></td>
        </tr>`;
    }).join("");

    body.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const row = e.target.closest("tr[data-row]");
      if (row) navigate(row.dataset.row);
    });
    body.addEventListener("keydown", (e) => {
      const row = e.target.closest("tr[data-row]");
      if (row && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        navigate(row.dataset.row);
      }
    });
  }

  function updateTable() {
    TABLE_IDS.forEach((id) => {
      const row = document.querySelector(`tr[data-row="${id}"]`);
      if (!row) return;
      const priceCell = row.querySelector('[data-cell="price"]');
      priceCell.textContent = MD.fmtPrice(id, MD.priceOf(id));
      const prevDir = Number(priceCell.dataset.dir || 0);
      const cur = MD.priceOf(id);
      const old = Number(priceCell.dataset.prev || cur);
      if (cur !== old) flash(priceCell, cur - old);
      priceCell.dataset.prev = String(cur);
      priceCell.dataset.dir = String(prevDir);

      row.querySelector('[data-cell="vol"]').textContent = MD.volumeLabel(id);
      const pct = MD.changePct(id);
      const badge = row.querySelector(".badge-up, .badge-down");
      badge.className = `badge ${pct >= 0 ? "badge-up" : "badge-down"} num`;
      badge.textContent = T.fmtPct(pct);
    });
  }

  function initShowcase() {
    const canvas = $("#showcase-chart");
    if (!canvas) return;
    const points = MD.history("EURUSD", 3600, 110).candles.map((c) => c.close);
    drawSeries(canvas, points);
    document.addEventListener("themechange", () => drawSeries(canvas, points));
  }

  let rafPending = false;
  function onTick() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const price = MD.priceOf(heroState.id);
      heroState.points.push(price);
      if (heroState.points.length > 140) heroState.points.shift();
      drawSpark();
      paintHero();
      updateTicker();
      updateTable();
    });
  }

  function boot() {
    initHero();
    buildTicker();
    buildTable();
    initShowcase();
    MD.subscribe(onTick);
    document.addEventListener("themechange", drawSpark);
    window.addEventListener("resize", T.debounce(drawSpark, 180));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
