(() => {
  "use strict";

  const T = window.TP;
  const MD = window.MarketData;
  if (!T || !MD) return;

  const { $, $$ } = T;
  const CLASS_LABELS = { forex: "Forex", stocks: "Stocks", indices: "Indices", commodities: "Commodities", crypto: "Crypto" };

  function resolveId() {
    const raw = decodeURIComponent(new URLSearchParams(window.location.search).get("symbol") || "").trim();
    if (raw) {
      if (MD.get(raw)) return raw;
      const bySym = MD.bySymbol(raw);
      if (bySym && MD.get(bySym.id)) return bySym.id;
    }
    return "EURUSD";
  }

  const state = { id: resolveId(), tf: 3600, type: "candles", side: "buy", kind: "market" };

  let chart = null;
  let mainSeries = null;
  let volSeries = null;
  let candles = [];
  const indicators = new Map();

  const els = {
    select: $("#symbol-select"),
    price: $("#t-price"),
    chg: $("#t-chg"),
    bid: $("#t-bid"),
    ask: $("#t-ask"),
    spread: $("#t-spread"),
    range: $("#t-range"),
    chartEl: $("#trading-chart"),
    fallback: $("#chart-fallback"),
    legend: $("#chart-legend"),
    lo: $("#lg-o"), lh: $("#lg-h"), ll: $("#lg-l"), lc: $("#lg-c"), lchg: $("#lg-chg"),
    amount: $("#order-amount"),
    limitField: $("#limit-field"), limitPrice: $("#limit-price"),
    stopField: $("#stop-field"), stopPrice: $("#stop-price"),
    slInput: $("#sl-input"), tpInput: $("#tp-input"),
    slHint: $("#sl-hint"), tpHint: $("#tp-hint"),
    sumNotional: $("#sum-notional"), sumMargin: $("#sum-margin"), sumPipVal: $("#sum-pipval"),
    cta: $("#order-cta"), placeBtn: $("#place-order-btn"),
    posBody: $("#positions-body"), posCount: $("#pos-count"), posEmpty: $("#positions-empty"),
    indSelect: $("#indicator-select"), indChips: $("#active-indicators")
  };

  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const hexA = (hex, a) => {
    let h = hex.trim();
    if (h.startsWith("#")) h = h.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return `rgba(30,92,70,${a})`;
    return `rgba(${r},${g},${b},${a})`;
  };

  function fillSelect() {
    const groups = {};
    MD.INSTRUMENTS.forEach((i) => (groups[i.cls] = groups[i.cls] || []).push(i));
    els.select.innerHTML = Object.entries(groups)
      .map(([cls, list]) =>
        `<optgroup label="${CLASS_LABELS[cls]}">` +
        list.map((i) => `<option value="${i.id}">${i.symbol} \u2014 ${T.escapeHtml(i.name)}</option>`).join("") +
        "</optgroup>")
      .join("");
    els.select.value = state.id;
  }

  function themeOptions() {
    return {
      layout: {
        background: { type: "solid", color: cssVar("--surface") || "#ffffff" },
        textColor: cssVar("--text-2") || "#45536b",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
      },
      grid: {
        vertLines: { color: cssVar("--border") || "#e5e9f0" },
        horzLines: { color: cssVar("--border") || "#e5e9f0" }
      },
      rightPriceScale: { borderColor: cssVar("--border-strong") || "#c9d3e0" },
      timeScale: {
        borderColor: cssVar("--border-strong") || "#c9d3e0",
        timeVisible: state.tf < 604800,
        secondsVisible: false
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      localization: { priceFormatter: (p) => MD.fmtPrice(state.id, p) }
    };
  }

  function createChart() {
    if (typeof LightweightCharts === "undefined") {
      els.fallback.hidden = false;
      return false;
    }
    chart = LightweightCharts.createChart(els.chartEl, themeOptions());
    volSeries = chart.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false
    });
    volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    buildMainSeries(state.type);

    new ResizeObserver(() => {
      if (!chart) return;
      chart.applyOptions({ width: els.chartEl.clientWidth, height: els.chartEl.clientHeight });
    }).observe(els.chartEl);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        paintLegend(candles[candles.length - 1]);
        return;
      }
      const bar = candles.find((c) => c.time === param.time);
      if (bar) paintLegend(bar);
    });
    return true;
  }

  function clearIndicators() {
    if (chart) indicators.forEach((ind) => ind.series.forEach((s) => chart.removeSeries(s)));
    indicators.clear();
    renderIndicatorChips();
  }

  function buildMainSeries(type) {
    state.type = type;
    if (!chart) return;
    clearIndicators();
    if (mainSeries) chart.removeSeries(mainSeries);

    const up = cssVar("--up") || "#059669";
    const down = cssVar("--down") || "#dc2626";
    const primary = cssVar("--primary") || "#1e5c46";

    if (type === "line") {
      mainSeries = chart.addLineSeries({ color: primary, lineWidth: 2 });
    } else if (type === "area") {
      mainSeries = chart.addAreaSeries({
        lineColor: primary,
        topColor: hexA(primary, 0.28),
        bottomColor: hexA(primary, 0),
        lineWidth: 2
      });
    } else {
      mainSeries = chart.addCandlestickSeries({
        upColor: up, downColor: down,
        borderUpColor: up, borderDownColor: down,
        wickUpColor: up, wickDownColor: down
      });
    }
    pushMainData();
    indicators.forEach((ind) => rebuildIndicator(ind.key));
  }

  function pushMainData() {
    if (!mainSeries) return;
    if (state.type === "line" || state.type === "area") {
      mainSeries.setData(candles.map((c) => ({ time: c.time, value: c.close })));
    } else {
      mainSeries.setData(candles);
    }
  }

  function loadData() {
    const hist = MD.history(state.id, state.tf, 200);
    candles = hist.candles;
    pushMainData();
    if (volSeries) volSeries.setData(hist.volume);
    if (chart) chart.timeScale().fitContent();
    indicators.forEach((ind) => rebuildIndicator(ind.key));
    paintLegend(candles[candles.length - 1]);
  }

  function paintLegend(bar) {
    if (!bar || !els.legend) return;
    els.legend.hidden = false;
    els.lo.textContent = MD.fmtPrice(state.id, bar.open);
    els.lh.textContent = MD.fmtPrice(state.id, bar.high);
    els.ll.textContent = MD.fmtPrice(state.id, bar.low);
    els.lc.textContent = MD.fmtPrice(state.id, bar.close);
    const diff = bar.close - bar.open;
    els.lchg.textContent = `${diff >= 0 ? "+" : "\u2212"}${MD.fmtPrice(state.id, Math.abs(diff))}`;
    els.lchg.className = "chg num " + (diff >= 0 ? "up" : "down");
  }

  // ---------- indicators ----------

  const sma = (data, period) => {
    const out = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i].close;
      if (i >= period) sum -= data[i - period].close;
      if (i >= period - 1) out.push({ time: data[i].time, value: sum / period });
    }
    return out;
  };

  const ema = (points, period) => {
    if (points.length < period) return [];
    const k = 2 / (period + 1);
    let acc = points[0].value !== undefined ? points[0].value : points[0].close;
    const seedTime = points[0].time;
    const out = [{ time: seedTime, value: acc }];
    for (let i = 1; i < points.length; i++) {
      const v = points[i].value !== undefined ? points[i].value : points[i].close;
      acc = v * k + acc * (1 - k);
      out.push({ time: points[i].time, value: acc });
    }
    return out;
  };

  const rsiCalc = (data, period) => {
    if (data.length <= period) return [];
    let gain = 0;
    let loss = 0;
    for (let i = 1; i <= period; i++) {
      const d = data[i].close - data[i - 1].close;
      if (d >= 0) gain += d; else loss -= d;
    }
    let avgGain = gain / period;
    let avgLoss = loss / period;
    const out = [];
    const pushRsi = (time) => {
      const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      out.push({ time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs) });
    };
    pushRsi(data[period].time);
    for (let i = period + 1; i < data.length; i++) {
      const d = data[i].close - data[i - 1].close;
      avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
      pushRsi(data[i].time);
    }
    return out;
  };

  const bollinger = (data, period, mult) => {
    const mid = sma(data, period);
    const upper = [];
    const lower = [];
    for (let i = period - 1; i < data.length; i++) {
      let sq = 0;
      for (let j = 0; j < period; j++) sq += Math.pow(data[i - j].close - mid[i - period + 1].value, 2);
      const sd = Math.sqrt(sq / period);
      upper.push({ time: data[i].time, value: mid[i - period + 1].value + sd * mult });
      lower.push({ time: data[i].time, value: mid[i - period + 1].value - sd * mult });
    }
    return { mid, upper, lower };
  };

  const macdCalc = (data) => {
    const closesAsPoints = data.map((c) => ({ time: c.time, value: c.close }));
    const e12 = ema(closesAsPoints, 12);
    const e26 = ema(closesAsPoints, 26);
    const offset = e12.length - e26.length;
    const line = e26.map((p, i) => ({ time: p.time, value: e12[i + offset].value - p.value }));
    const signal = ema(line, 9);
    const sigOffset = line.length - signal.length;
    const hist = signal.map((p, i) => ({
      time: p.time,
      value: line[i + sigOffset].value - p.value,
      color: line[i + sigOffset].value >= p.value ? "rgba(23,128,63,0.5)" : "rgba(187,58,48,0.5)"
    }));
    return { line, signal, hist };
  };

  function subPaneBusy(key) {
    return [...indicators.keys()].some((k) => k === "rsi" || k === "macd");
  }

  function rebuildIndicator(key) {
    const ind = indicators.get(key);
    if (!ind || !chart) return;
    ind.series.forEach((s) => chart.removeSeries(s));
    ind.series = [];

    const primary = cssVar("--primary") || "#1e5c46";
    const warn = cssVar("--warn") || "#b45309";

    if (key === "sma" || key === "ema") {
      const data = key === "sma" ? sma(candles, 20) : ema(candles.map((c) => ({ time: c.time, value: c.close })), 20);
      const s = chart.addLineSeries({ color: primary, lineWidth: 1, title: key.toUpperCase() + " 20", priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(data);
      ind.series.push(s);
    } else if (key === "bb") {
      const bb = bollinger(candles, 20, 2);
      const mk = (data, color) => {
        const s = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        s.setData(data);
        ind.series.push(s);
      };
      mk(bb.upper, warn);
      mk(bb.mid, primary);
      mk(bb.lower, warn);
    } else if (key === "rsi") {
      const pane = chart.addLineSeries({
        color: "#8c3b4a", lineWidth: 1, title: "RSI 14",
        priceScaleId: "rsi-pane", priceLineVisible: false
      });
      pane.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
      pane.setData(rsiCalc(candles, 14));
      ind.series.push(pane);
    } else if (key === "macd") {
      const m = macdCalc(candles);
      const h = chart.addHistogramSeries({ priceScaleId: "macd-pane", priceLineVisible: false, lastValueVisible: false });
      h.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
      h.setData(m.hist);
      const ln = chart.addLineSeries({ color: primary, lineWidth: 1, priceScaleId: "macd-pane", priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      ln.setData(m.line);
      const sg = chart.addLineSeries({ color: warn, lineWidth: 1, priceScaleId: "macd-pane", priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      sg.setData(m.signal);
      ind.series.push(h, ln, sg);
    }
  }

  function renderIndicatorChips() {
    if (!indicators.size) {
      els.indChips.hidden = true;
      els.indChips.innerHTML = "";
      return;
    }
    els.indChips.hidden = false;
    els.indChips.innerHTML = [...indicators.entries()]
      .map(([key, ind]) => `<span class="indicator-chip">${ind.label}<button type="button" data-remove-ind="${key}" aria-label="Remove ${ind.label}"><i class="fa-solid fa-xmark"></i></button></span>`)
      .join("");
  }

  const INDICATOR_LABELS = { sma: "SMA 20", ema: "EMA 20", rsi: "RSI 14", macd: "MACD", bb: "Bollinger Bands" };
  const SUB_PANES = ["rsi", "macd"];

  els.indSelect.addEventListener("change", () => {
    const key = els.indSelect.value;
    if (!key) return;
    els.indSelect.selectedIndex = 0;
    if (indicators.has(key)) {
      T.toast.info(`${INDICATOR_LABELS[key]} is already on the chart.`, "Already added");
      return;
    }
    if (SUB_PANES.includes(key)) {
      const other = SUB_PANES.find((k) => indicators.has(k));
      if (other) {
        indicators.get(other).series.forEach((s) => chart.removeSeries(s));
        indicators.delete(other);
        T.toast.info(`Replaced ${INDICATOR_LABELS[other]} — only one lower pane fits.`, "Pane swapped");
      }
    }
    indicators.set(key, { label: INDICATOR_LABELS[key], series: [] });
    rebuildIndicator(key);
    renderIndicatorChips();
  });

  els.indChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-ind]");
    if (!btn) return;
    const key = btn.dataset.removeInd;
    const ind = indicators.get(key);
    if (ind) ind.series.forEach((s) => chart.removeSeries(s));
    indicators.delete(key);
    renderIndicatorChips();
  });

  // ---------- header quote ----------

  function paintHeader(dir) {
    const s = MD.get(state.id);
    const inst = s.inst;
    const { bid, ask } = MD.bidAsk(state.id);
    els.price.textContent = MD.fmtPrice(state.id, s.price);
    if (dir !== undefined && dir !== 0) flash(els.price, dir);

    const pct = MD.changePct(state.id);
    const abs = MD.change(state.id);
    els.chg.className = `badge ${pct >= 0 ? "badge-up" : "badge-down"} num`;
    els.chg.textContent = `${abs >= 0 ? "+" : "\u2212"}${MD.fmtPrice(state.id, Math.abs(abs))} (${T.fmtPct(pct)})`;

    els.bid.textContent = MD.fmtPrice(state.id, bid);
    els.ask.textContent = MD.fmtPrice(state.id, ask);
    els.spread.textContent = MD.fmtPrice(state.id, MD.spreadAbs(state.id));
    els.range.textContent = `${MD.fmtPrice(state.id, s.low)} \u2013 ${MD.fmtPrice(state.id, s.high)}`;
    document.title = `${inst.symbol} ${MD.fmtPrice(state.id, s.price)} — TradePro`;
  }

  function flash(el, dir) {
    el.classList.remove("price-flash-up", "price-flash-down");
    void el.offsetWidth;
    el.classList.add(dir > 0 ? "price-flash-up" : "price-flash-down");
  }

  // ---------- live updates ----------

  let lastHeaderPrice = null;

  function onTick() {
    const cur = MD.priceOf(state.id);
    const dir = lastHeaderPrice === null ? 0 : cur - lastHeaderPrice;
    lastHeaderPrice = cur;

    const nowSec = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(nowSec / state.tf) * state.tf;

    if (candles.length) {
      const last = candles[candles.length - 1];
      if (bucket > last.time) {
        candles.push({ time: bucket, open: last.close, high: Math.max(last.close, cur), low: Math.min(last.close, cur), close: cur });
        if (candles.length > 400) candles.shift();
        if (volSeries) {
          volSeries.update({ time: bucket, value: Math.floor(MD.get(state.id).inst.volBase * 0.00002 * state.tf), color: "rgba(23,128,63,0.45)" });
        }
        if (mainSeries && (state.type === "line" || state.type === "area")) {
          mainSeries.update({ time: bucket, value: cur });
        } else if (mainSeries) {
          mainSeries.update(candles[candles.length - 1]);
        }
      } else if (bucket === last.time) {
        last.high = Math.max(last.high, cur);
        last.low = Math.min(last.low, cur);
        last.close = cur;
        if (mainSeries) {
          if (state.type === "line" || state.type === "area") mainSeries.update({ time: bucket, value: cur });
          else mainSeries.update(last);
        }
      }
    }

    paintHeader(dir);
    paintLegend(candles[candles.length - 1]);
    refreshPositionRows();
    recalcSummary();

    checkPendingFills();
  }

  let rafPending = false;
  MD.subscribe(() => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      onTick();
    });
  });

  // ---------- order ticket ----------

  function lots() {
    const v = parseFloat(els.amount.value);
    return Number.isFinite(v) ? v : 0;
  }

  function contractOf() {
    return MD.get(state.id)?.inst.contract ?? 1;
  }

  function recalcSummary() {
    const price = MD.priceOf(state.id);
    const n = lots();
    const contract = contractOf();
    const leverage = MD.leverageOf(state.id);
    const inst = MD.get(state.id)?.inst;
    els.sumNotional.textContent = T.fmtMoney(price * n * contract);
    els.sumMargin.textContent = T.fmtMoney((price * n * contract) / leverage);
    els.sumPipVal.textContent = T.fmtMoney((inst?.pip ?? 0.0001) * n * contract);
    updateSlTpHints();
  }

  function refEntry() {
    const { bid, ask } = MD.bidAsk(state.id);
    return state.side === "buy" ? ask : bid;
  }

  function updateSlTpHints() {
    const inst = MD.get(state.id)?.inst;
    if (!inst) return;
    const entry = refEntry();
    const sl = parseFloat(els.slInput.value);
    const tp = parseFloat(els.tpInput.value);
    if (Number.isFinite(sl) && sl > 0) {
      const lvl = state.side === "buy" ? entry - sl * inst.pip : entry + sl * inst.pip;
      els.slHint.textContent = `\u2248 ${MD.fmtPrice(state.id, lvl)} (${state.side === "buy" ? "below" : "above"} entry)`;
    } else {
      els.slHint.textContent = "";
    }
    if (Number.isFinite(tp) && tp > 0) {
      const lvl = state.side === "buy" ? entry + tp * inst.pip : entry - tp * inst.pip;
      els.tpHint.textContent = `\u2248 ${MD.fmtPrice(state.id, lvl)} (${state.side === "buy" ? "above" : "below"} entry)`;
    } else {
      els.tpHint.textContent = "";
    }
  }

  function setSide(side) {
    state.side = side;
    $("#side-buy").classList.toggle("active", side === "buy");
    $("#side-buy").setAttribute("aria-checked", String(side === "buy"));
    $("#side-sell").classList.toggle("active", side === "sell");
    $("#side-sell").setAttribute("aria-checked", String(side === "sell"));
    els.placeBtn.classList.toggle("btn-up", side === "buy");
    els.placeBtn.classList.toggle("btn-down", side === "sell");
    updateCta();
    updateSlTpHints();
  }

  function setKind(kind) {
    state.kind = kind;
    $$("#order-kind .seg-btn").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.kind === kind)));
    els.limitField.hidden = kind !== "limit";
    els.stopField.hidden = kind !== "stop";
    updateCta();
  }

  function updateCta() {
    const verb = state.side === "buy" ? "Buy" : "Sell";
    els.cta.textContent = `${verb} ${state.kind} \u00b7 ${MD.get(state.id)?.inst.symbol ?? ""}`;
  }

  $("#order-kind").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-kind]");
    if (btn) setKind(btn.dataset.kind);
  });
  $(".side-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".side-btn");
    if (btn) setSide(btn.dataset.side);
  });
  $("#amount-chips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-amt]");
    if (!chip) return;
    els.amount.value = chip.dataset.amt;
    recalcSummary();
  });
  ["#order-amount", "#sl-input", "#tp-input"].forEach((sel) => $(sel).addEventListener("input", recalcSummary));

  function fieldError(input, msg) {
    const field = input.closest(".field");
    const err = field?.querySelector(".field-error");
    if (err) err.textContent = msg || "";
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }

  $("#order-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = TP_Auth_guard();
    if (!user) return;

    let ok = true;
    ok = fieldError(els.amount, lots() > 0 ? "" : "Enter an amount greater than zero.") && ok;

    let trigger = null;
    if (state.kind === "limit") {
      const v = parseFloat(els.limitPrice.value);
      if (!Number.isFinite(v) || v <= 0) {
        ok = fieldError(els.limitPrice, "Enter a valid limit price.") && ok;
      } else {
        trigger = v;
        fieldError(els.limitPrice, "");
      }
    }
    if (state.kind === "stop") {
      const v = parseFloat(els.stopPrice.value);
      if (!Number.isFinite(v) || v <= 0) {
        ok = fieldError(els.stopPrice, "Enter a valid stop price.") && ok;
      } else {
        trigger = v;
        fieldError(els.stopPrice, "");
      }
    }
    if (!ok) return;

    const inst = MD.get(state.id).inst;
    const baseOrder = {
      symbolId: state.id,
      symbol: inst.symbol,
      side: state.side,
      lots: lots(),
      type: state.kind
    };
    const sl = parseFloat(els.slInput.value);
    const tp = parseFloat(els.tpInput.value);
    if (Number.isFinite(sl) && sl > 0) baseOrder.slPips = sl;
    if (Number.isFinite(tp) && tp > 0) baseOrder.tpPips = tp;

    T.btnLoading(els.placeBtn, true);
    await new Promise((r) => setTimeout(r, 450));

    if (state.kind === "market") {
      const { bid, ask } = MD.bidAsk(state.id);
      const fill = state.side === "buy" ? ask : bid;
      T.Store.addOrder({ ...baseOrder, price: fill, status: "filled" });
      T.Store.addPosition({
        symbolId: state.id, symbol: inst.symbol, side: state.side, lots: lots(), entry: fill
      });
      T.toast.success(
        `${state.side === "buy" ? "Bought" : "Sold"} ${lots()} lot${lots() === 1 ? "" : "s"} ${inst.symbol} @ ${MD.fmtPrice(state.id, fill)}`,
        "Order filled"
      );
      renderPositions();
    } else {
      T.Store.addOrder({ ...baseOrder, price: trigger, status: "pending" });
      T.toast.info(
        `${state.side === "buy" ? "Buy" : "Sell"} ${inst.symbol} will trigger at ${MD.fmtPrice(state.id, trigger)}.`,
        `${state.kind === "limit" ? "Limit" : "Stop"} order placed`
      );
    }

    T.btnLoading(els.placeBtn, false);
  });

  function TP_Auth_guard() {
    const user = T.Auth.current();
    if (!user) {
      T.toast.warning("Please log in to place orders.", "Sign in required");
      setTimeout(() => { window.location.href = "login.html"; }, 800);
      return null;
    }
    return user;
  }

  // ---------- positions ----------

  function positionPL(pos) {
    const cur = MD.priceOf(pos.symbolId);
    const contract = MD.get(pos.symbolId)?.inst.contract ?? 1;
    const dir = pos.side === "buy" ? 1 : -1;
    const pl = (cur - pos.entry) * pos.lots * contract * dir;
    const pct = pos.entry ? ((cur - pos.entry) / pos.entry) * 100 * dir : 0;
    return { pl, pct, cur };
  }

  function renderPositions() {
    const positions = T.Store.data.positions;
    els.posCount.textContent = String(positions.length);
    els.posEmpty.hidden = positions.length > 0;
    document.querySelector(".positions-card .table-scroll").hidden = !positions.length;

    els.posBody.innerHTML = positions.map((pos) => {
      const { pl, pct, cur } = positionPL(pos);
      const cls = pl >= 0 ? "positive" : "negative";
      const sideCls = pos.side === "buy" ? "badge-up" : "badge-down";
      return `
        <tr data-pos="${pos.id}">
          <td><strong>${T.escapeHtml(pos.symbol)}</strong><br><small class="muted">${new Date(pos.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></td>
          <td class="cell-num num">${T.fmtNum(pos.lots, 0, 2)}</td>
          <td class="cell-num num">${MD.fmtPrice(pos.symbolId, pos.entry)}</td>
          <td class="cell-num num hide-sm-col" data-cur>${MD.fmtPrice(pos.symbolId, cur)}</td>
          <td class="cell-num num ${cls}" data-pl>${pl >= 0 ? "+" : "\u2212"}$${T.fmtNum(Math.abs(pl), 2, 2)}</td>
          <td class="cell-num"><button type="button" class="btn btn-secondary btn-sm" data-close="${pos.id}">Close</button></td>
        </tr>`;
    }).join("");
  }

  function refreshPositionRows() {
    $$("#positions-body tr[data-pos]").forEach((row) => {
      const id = row.dataset.pos;
      const pos = T.Store.data.positions.find((p) => p.id === id);
      if (!pos) return;
      const { pl, cur } = positionPL(pos);
      row.querySelector("[data-cur]").textContent = MD.fmtPrice(pos.symbolId, cur);
      const cell = row.querySelector("[data-pl]");
      cell.textContent = `${pl >= 0 ? "+" : "\u2212"}$${T.fmtNum(Math.abs(pl), 2, 2)}`;
      cell.className = `cell-num num ${pl >= 0 ? "positive" : "negative"}`;
    });
  }

  els.posBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-close]");
    if (!btn) return;
    const pos = T.Store.data.positions.find((p) => p.id === btn.dataset.close);
    if (!pos) return;
    const { pl } = positionPL(pos);
    const confirmed = await T.confirmDialog({
      title: `Close ${pos.symbol} position?`,
      message: `You will realise a ${pl >= 0 ? "profit" : "loss"} of ${T.fmtSignedMoney(pl)} at the current market price.`,
      confirmText: "Close position",
      danger: true,
      icon: "fa-handshake-angle"
    });
    if (!confirmed) return;

    const { bid, ask } = MD.bidAsk(pos.symbolId);
    const exit = pos.side === "buy" ? bid : ask;
    const finalPl = (exit - pos.entry) * pos.lots * (MD.get(pos.symbolId)?.inst.contract ?? 1) * (pos.side === "buy" ? 1 : -1);

    T.Store.removePosition(pos.id);
    T.Store.adjustCash(finalPl);
    T.Store.addTx({
      kind: finalPl >= 0 ? "profit" : "loss",
      method: `Closed ${pos.symbol}`,
      amount: Math.abs(finalPl)
    });
    T.toast.success(`${pos.symbol} closed at ${MD.fmtPrice(pos.symbolId, exit)} \u00b7 ${T.fmtSignedMoney(finalPl)}`, "Position closed");
    renderPositions();
  });

  // ---------- pending order engine ----------

  function checkPendingFills() {
    const pendings = T.Store.data.orders.filter((o) => o.status === "pending");
    pendings.forEach((o) => {
      const feed = MD.bidAsk(o.symbolId);
      let fill = null;
      if (o.type === "limit" && o.side === "buy" && feed.ask <= o.price) fill = o.price;
      if (o.type === "limit" && o.side === "sell" && feed.bid >= o.price) fill = o.price;
      if (o.type === "stop" && o.side === "buy" && feed.ask >= o.price) fill = o.price;
      if (o.type === "stop" && o.side === "sell" && feed.bid <= o.price) fill = o.price;
      if (fill === null) return;

      T.Store.setOrderStatus(o.id, "filled");
      T.Store.addPosition({
        symbolId: o.symbolId, symbol: o.symbol, side: o.side, lots: o.lots, entry: fill
      });
      T.toast.success(`${o.symbol} ${o.type} order filled @ ${MD.fmtPrice(o.symbolId, fill)}`, "Triggered");
      renderPositions();
    });
  }

  // ---------- controls ----------

  $("#tf-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tf]");
    if (!btn) return;
    $$("#tf-tabs .seg-btn").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    state.tf = Number(btn.dataset.tf);
    if (chart) chart.applyOptions({ timeScale: { ...themeOptions().timeScale } });
    loadData();
  });

  $("#type-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-type]");
    if (!btn) return;
    $$("#type-tabs .seg-btn").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    buildMainSeries(btn.dataset.type);
  });

  $("#fullscreen-btn").addEventListener("click", () => {
    const card = document.querySelector(".chart-card");
    if (!document.fullscreenElement) {
      card.requestFullscreen?.().then(() => {
        $("#fullscreen-btn i").className = "fa-solid fa-compress";
      }).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => {
        $("#fullscreen-btn i").className = "fa-solid fa-expand";
      });
    }
  });

  document.addEventListener("fullscreenchange", () => {
    $("#fullscreen-btn i").className = document.fullscreenElement ? "fa-solid fa-compress" : "fa-solid fa-expand";
  });

  document.addEventListener("themechange", () => {
    if (!chart) return;
    chart.applyOptions(themeOptions());
    buildMainSeries(state.type);
    if (volSeries) volSeries.setData(MD.history(state.id, state.tf, 200).volume);
  });

  els.select.addEventListener("change", () => {
    state.id = els.select.value;
    lastHeaderPrice = null;
    clearIndicators();
    loadData();
    paintHeader(0);
    recalcSummary();
    try {
      window.history.replaceState(null, "", `?symbol=${state.id}`);
    } catch (_) {}
  });

  window.addEventListener("resize", T.debounce(recalcSummary, 150));

  // ---------- boot ----------

  fillSelect();
  setKind("market");
  setSide("buy");
  paintHeader(0);
  recalcSummary();
  renderPositions();
  updateCta();
  const chartReady = createChart();
  if (chartReady) loadData();
  else {
    candles = MD.history(state.id, state.tf, 10).candles;
    paintLegend(candles[candles.length - 1]);
  }
})();
