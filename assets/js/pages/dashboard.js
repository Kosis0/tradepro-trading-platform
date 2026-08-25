(() => {
  "use strict";

  const T = window.TP;
  const MD = window.MarketData;
  if (!T || !MD) return;

  const { $, $$ } = T;

  const user = T.requireAuth();
  if (!user) return;

  const COUNTRIES = ["AU","BR","CA","AE","FR","DE","IN","IT","JP","NL","SG","ZA","ES","GB","US"];
  const COUNTRY_NAMES = {
    AU:"Australia", BR:"Brazil", CA:"Canada", AE:"United Arab Emirates", FR:"France",
    DE:"Germany", IN:"India", IT:"Italy", JP:"Japan", NL:"Netherlands", SG:"Singapore",
    ZA:"South Africa", ES:"Spain", GB:"United Kingdom", US:"United States"
  };
  const CLASS_COLORS = {
    forex: "#1e5c46",
    stocks: "#2c6e7f",
    indices: "#66763a",
    commodities: "#a9683a",
    crypto: "#7d4a5b",
    cash: "#8f9284"
  };
  const CLASS_LABELS = { forex: "Forex", stocks: "Stocks", indices: "Indices", commodities: "Commodities", crypto: "Crypto", cash: "Cash" };

  const els = {
    sbEquity: $("#sb-equity"), sbCash: $("#sb-cash"), sbFloating: $("#sb-floating"),
    statEquity: $("#stat-equity"), statCash: $("#stat-cash"), statMargin: $("#stat-margin"), statFree: $("#stat-free"),
    perfRange: $("#perf-range"), equityChart: $("#equity-chart"), equityFallback: $("#equity-fallback"),
    posBody: $("#dash-positions-body"), posEmpty: $("#dash-positions-empty"),
    donut: $("#alloc-donut"), donutTotal: $("#alloc-total"), allocLegend: $("#alloc-legend"),
    holdingsBody: $("#holdings-body"), holdingsEmpty: $("#holdings-empty"),
    txBody: $("#tx-body"), txEmpty: $("#tx-empty"), txFilter: $("#tx-filter"),
    ordersBody: $("#orders-body"), ordersEmpty: $("#orders-empty"), orderFilter: $("#order-filter"),
    fundCash: $("#fund-cash"), fundingBody: $("#funding-body")
  };

  function posPL(pos) {
    const cur = MD.priceOf(pos.symbolId);
    const contract = MD.get(pos.symbolId)?.inst.contract ?? 1;
    const dir = pos.side === "buy" ? 1 : -1;
    const pl = (cur - pos.entry) * pos.lots * contract * dir;
    const pct = pos.entry ? ((cur - pos.entry) / pos.entry) * 100 * dir : 0;
    return { pl, pct, cur };
  }

  const floatingPL = () =>
    T.Store.data.positions.reduce((sum, p) => sum + posPL(p).pl, 0);

  const usedMargin = () =>
    T.Store.data.positions.reduce((sum, p) => {
      const contract = MD.get(p.symbolId)?.inst.contract ?? 1;
      return sum + (p.entry * p.lots * contract) / MD.leverageOf(p.symbolId);
    }, 0);

  const equityNow = () => T.Store.data.cash + floatingPL();

  const money = (v) => T.fmtMoney(v);
  const signedMoney = (v) => `${v >= 0 ? "+" : "\u2212"}${money(Math.abs(v))}`;

  // ---------- section navigation ----------

  const SECTION_TITLES = {
    overview: "Dashboard — TradePro",
    portfolio: "Portfolio — TradePro",
    transactions: "Transactions — TradePro",
    orders: "Orders — TradePro",
    account: "Account settings — TradePro",
    security: "Security — TradePro",
    funding: "Funding — TradePro"
  };

  function showSection(id, pushHash) {
    if (!SECTION_TITLES[id]) id = "overview";
    $$(".dash-section").forEach((s) => (s.hidden = s.id !== id));
    $$(".dash-nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${id}`));
    document.title = SECTION_TITLES[id];
    if (pushHash !== false && window.location.hash !== `#${id}`) {
      window.history.replaceState(null, "", `#${id}`);
    }
    if (id === "portfolio") renderPortfolio();
    if (id === "overview" && perfChart) perfChart.timeScale().applyOptions({});
  }

  document.body.addEventListener("click", (e) => {
    const link = e.target.closest("[data-nav]");
    if (!link) return;
    const id = (link.getAttribute("href") || "").replace("#", "");
    if (!SECTION_TITLES[id]) return;
    e.preventDefault();
    showSection(id);
  });

  window.addEventListener("hashchange", () => showSection(window.location.hash.replace("#", ""), false));

  // ---------- overview ----------

  function paintStats() {
    const eq = equityNow();
    const fl = floatingPL();
    const um = usedMargin();
    els.sbEquity.textContent = money(eq);
    els.sbCash.textContent = money(T.Store.data.cash);
    els.sbFloating.textContent = signedMoney(fl);
    els.sbFloating.className = fl >= 0 ? "positive" : "negative";
    els.statEquity.textContent = money(eq);
    els.statCash.textContent = money(T.Store.data.cash);
    els.statMargin.textContent = money(um);
    els.statFree.textContent = money(freeMargin());
    els.fundCash.textContent = money(T.Store.data.cash);
  }

  function renderOverviewPositions() {
    const positions = T.Store.data.positions;
    els.posEmpty.hidden = positions.length > 0;
    document.querySelector("#overview .table-scroll").hidden = !positions.length;
    els.posBody.innerHTML = positions.map((pos) => {
      const { pl, pct, cur } = posPL(pos);
      const cls = pl >= 0 ? "positive" : "negative";
      return `
        <tr data-pos="${pos.id}">
          <td><strong>${T.escapeHtml(pos.symbol)}</strong></td>
          <td><span class="badge ${pos.side === "buy" ? "badge-up" : "badge-down"}">${pos.side === "buy" ? "Buy" : "Sell"}</span></td>
          <td class="cell-num num">${T.fmtNum(pos.lots, 0, 2)}</td>
          <td class="cell-num num hide-md-col">${MD.fmtPrice(pos.symbolId, pos.entry)}</td>
          <td class="cell-num num" data-cur>${MD.fmtPrice(pos.symbolId, cur)}</td>
          <td class="cell-num num ${cls}" data-pl>${signedMoney(pl)} <small>(${T.fmtPct(pct)})</small></td>
          <td class="cell-num"><button type="button" class="btn btn-secondary btn-sm" data-close="${pos.id}">Close</button></td>
        </tr>`;
    }).join("");
  }

  els.posBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-close]");
    if (!btn) return;
    const pos = T.Store.data.positions.find((p) => p.id === btn.dataset.close);
    if (!pos) return;
    const { pl } = posPL(pos);
    const ok = await T.confirmDialog({
      title: `Close ${pos.symbol}?`,
      message: `Realising ${signedMoney(pl)} at the current market price.`,
      confirmText: "Close position",
      danger: true,
      icon: "fa-handshake-angle"
    });
    if (!ok) return;
    const feed = MD.bidAsk(pos.symbolId);
    const exit = pos.side === "buy" ? feed.bid : feed.ask;
    const contract = MD.get(pos.symbolId)?.inst.contract ?? 1;
    const finalPl = (exit - pos.entry) * pos.lots * contract * (pos.side === "buy" ? 1 : -1);
    T.Store.removePosition(pos.id);
    T.Store.adjustCash(finalPl);
    T.Store.addTx({ kind: finalPl >= 0 ? "profit" : "loss", method: `Closed ${pos.symbol}`, amount: Math.abs(finalPl) });
    T.toast.success(`${pos.symbol} closed \u00b7 ${signedMoney(finalPl)}`, "Position closed");
    renderOverviewPositions();
    paintStats();
    renderTxTable();
    renderFundingTable();
  });

  // ---------- performance chart ----------

  let perfChart = null;
  let perfSeries = null;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function strSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const RANGES = {
    "1d": { n: 24, step: 3600, vol: 0.004 },
    "1w": { n: 56, step: 10800, vol: 0.007 },
    "1m": { n: 30, step: 86400, vol: 0.012 },
    "3m": { n: 66, step: 86400 * 1.5, vol: 0.02 },
    "1y": { n: 52, step: 604800, vol: 0.034 }
  };

  function genCurve(rangeKey) {
    const cfg = RANGES[rangeKey];
    const end = equityNow();
    const rand = mulberry32(strSeed(rangeKey) + Math.round(end));
    const values = new Array(cfg.n);
    values[cfg.n - 1] = end;
    const scale = Math.sqrt(cfg.step / 86400);
    for (let i = cfg.n - 2; i >= 0; i--) {
      const drift = (rand() - 0.47) * cfg.vol * scale;
      values[i] = Math.max(500, values[i + 1] / (1 + drift));
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const useDates = cfg.step >= 86400;
    const data = [];
    for (let i = 0; i < cfg.n; i++) {
      const t = nowSec - (cfg.n - 1 - i) * cfg.step;
      if (useDates) {
        const d = new Date(t * 1000);
        const iso = d.toISOString().slice(0, 10);
        data.push({ time: iso, value: values[i] });
      } else {
        data.push({ time: t, value: values[i] });
      }
    }
    return data;
  }

  function themePerfOptions() {
    const css = getComputedStyle(document.documentElement);
    return {
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: css.getPropertyValue("--text-3").trim(),
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
      },
      grid: {
        vertLines: { color: css.getPropertyValue("--border").trim() },
        horzLines: { color: css.getPropertyValue("--border").trim() }
      },
      rightPriceScale: { borderColor: css.getPropertyValue("--border").trim() },
      timeScale: { borderColor: css.getPropertyValue("--border").trim() },
      localization: {
        priceFormatter: (p) => "$" + T.fmtNum(p, 0, 0)
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal }
    };
  }

  function drawPerformance() {
    if (typeof LightweightCharts === "undefined") {
      els.equityFallback.hidden = false;
      els.equityChart.style.display = "none";
      return;
    }
    const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#1e5c46";
    const range = els.perfRange.value;

    if (!perfChart) {
      perfChart = LightweightCharts.createChart(els.equityChart, {
        ...themePerfOptions(),
        width: els.equityChart.clientWidth,
        height: 300
      });
      new ResizeObserver(() => {
        if (perfChart) perfChart.applyOptions({ width: els.equityChart.clientWidth });
      }).observe(els.equityChart);
    }
    if (!perfSeries) {
      perfSeries = perfChart.addAreaSeries({ lineWidth: 2, priceLineVisible: false });
    }
    perfSeries.applyOptions({
      lineColor: primary,
      topColor: hexA(primary, 0.24),
      bottomColor: hexA(primary, 0)
    });
    perfSeries.setData(genCurve(range));
    perfChart.timeScale().fitContent();
  }

  function hexA(hex, a) {
    let h = String(hex).trim();
    if (h.startsWith("#")) h = h.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return `rgba(30,92,70,${a})`;
    return `rgba(${r},${g},${b},${a})`;
  }

  els.perfRange.addEventListener("change", drawPerformance);
  document.addEventListener("themechange", drawPerformance);

  // ---------- portfolio ----------

  function groupedHoldings() {
    const map = new Map();
    T.Store.data.positions.forEach((p) => {
      const key = p.symbolId;
      if (!map.has(key)) map.set(key, { symbolId: key, symbol: p.symbol, side: p.side, lots: 0, entrySum: 0 });
      const h = map.get(key);
      h.lots += p.lots;
      h.entrySum += p.entry * p.lots;
    });
    return [...map.values()].map((h) => ({
      ...h,
      avgEntry: h.lots ? h.entrySum / h.lots : 0
    }));
  }

  function renderPortfolio() {
    const holdings = groupedHoldings();
    els.holdingsEmpty.hidden = holdings.length > 0;
    document.querySelector("#portfolio .table-scroll").hidden = !holdings.length;
    els.holdingsBody.innerHTML = holdings.map((h) => {
      const contract = MD.get(h.symbolId)?.inst.contract ?? 1;
      const cur = MD.priceOf(h.symbolId);
      const dir = h.side === "buy" ? 1 : -1;
      const value = cur * h.lots * contract;
      const pl = (cur - h.avgEntry) * h.lots * contract * dir;
      const cls = pl >= 0 ? "positive" : "negative";
      return `
        <tr>
          <td><strong>${T.escapeHtml(h.symbol)}</strong></td>
          <td class="cell-num num">${T.fmtNum(h.lots, 0, 2)}</td>
          <td class="cell-num num hide-md-col">${MD.fmtPrice(h.symbolId, h.avgEntry)}</td>
          <td class="cell-num num">${money(value)}</td>
          <td class="cell-num num ${cls}">${signedMoney(pl)}</td>
        </tr>`;
    }).join("");

    const eq = equityNow();
    const totals = { forex: 0, stocks: 0, indices: 0, commodities: 0, crypto: 0 };
    holdings.forEach((h) => {
      const cls = MD.get(h.symbolId)?.inst.cls;
      if (cls && cls in totals) {
        const contract = MD.get(h.symbolId)?.inst.contract ?? 1;
        totals[cls] += MD.priceOf(h.symbolId) * h.lots * contract;
      }
    });
    const entries = Object.entries(totals).filter(([, v]) => v > 0);
    const cashPart = Math.max(0, T.Store.data.cash);
    const grand = cashPart + entries.reduce((s, [, v]) => s + v, 0);

    els.donutTotal.textContent = money(grand);
    let acc = 0;
    const stops = [];
    const legendRows = [];
    const pushSlice = (key, value) => {
      const frac = grand > 0 ? value / grand : 0;
      if (frac <= 0) return;
      const startDeg = acc * 360;
      acc += frac;
      const endDeg = acc * 360;
      stops.push(`${CLASS_COLORS[key]} ${startDeg.toFixed(2)}deg ${endDeg.toFixed(2)}deg`);
      legendRows.push(
        `<li>
          <span class="alloc-swatch" style="background:${CLASS_COLORS[key]}"></span>
          <span class="al-name">${CLASS_LABELS[key]}</span>
          <span class="al-value num">${money(value)}</span>
          <span class="al-pct num">${(frac * 100).toFixed(1)}%</span>
        </li>`
      );
    };
    entries.forEach(([cls, v]) => pushSlice(cls, v));
    if (!entries.length) pushSlice("cash", grand);
    else pushSlice("cash", cashPart);

    els.donut.style.background = stops.length ? `conic-gradient(${stops.join(", ")})` : "";
    els.allocLegend.innerHTML = legendRows.join("") ||
      `<li class="muted">Fund your account and open trades to see your allocation.</li>`;
  }

  // ---------- transactions ----------

  const TX_KINDS = {
    deposit: { label: "Deposit", cls: "badge-primary" },
    withdrawal: { label: "Withdrawal", cls: "badge-warn" },
    profit: { label: "Trading P/L", cls: "badge-up" },
    loss: { label: "Trading P/L", cls: "badge-down" }
  };

  const signForKind = { deposit: 1, profit: 1, withdrawal: -1, loss: -1 };

  function renderTxTable() {
    const filter = els.txFilter.value;
    const rows = T.Store.data.txs.filter((tx) => {
      if (filter === "all") return true;
      if (filter === "trading") return tx.kind === "profit" || tx.kind === "loss";
      return tx.kind === filter;
    });
    els.txEmpty.hidden = rows.length > 0;
    document.querySelector("#transactions .table-scroll").hidden = !rows.length;
    els.txBody.innerHTML = rows.map((tx) => {
      const meta = TX_KINDS[tx.kind] || { label: tx.kind, cls: "badge-neutral" };
      const sign = signForKind[tx.kind] ?? 1;
      const amtCls = sign > 0 ? "positive" : "negative";
      return `
        <tr>
          <td><span class="badge ${meta.cls}">${meta.label}</span></td>
          <td>${T.escapeHtml(tx.method || "\u2013")}</td>
          <td class="cell-num num ${amtCls}">${sign > 0 ? "+" : "\u2212"}${money(tx.amount)}</td>
          <td><span class="badge ${tx.status === "completed" ? "badge-up" : "badge-warn"}">${T.escapeHtml(tx.status)}</span></td>
          <td class="hide-md-col muted">${T.fmtDate(tx.time)}</td>
        </tr>`;
    }).join("");
  }

  els.txFilter.addEventListener("change", renderTxTable);

  // ---------- orders ----------

  function renderOrders() {
    const filter = els.orderFilter.value;
    const rows = T.Store.data.orders.filter((o) => filter === "all" || o.status === filter);
    els.ordersEmpty.hidden = rows.length > 0;
    document.querySelector("#orders .table-scroll").hidden = !rows.length;
    els.ordersBody.innerHTML = rows.map((o) => {
      const statusCls = o.status === "filled" ? "badge-up" : o.status === "pending" ? "badge-warn" : "badge-neutral";
      return `
        <tr>
          <td><strong>${T.escapeHtml(o.symbol)}</strong></td>
          <td><span class="badge ${o.side === "buy" ? "badge-up" : "badge-down"}">${o.side === "buy" ? "Buy" : "Sell"}</span></td>
          <td class="text-cap">${T.escapeHtml(o.type)}</td>
          <td class="cell-num num">${T.fmtNum(o.lots, 0, 2)}</td>
          <td class="cell-num num hide-md-col">${MD.get(o.symbolId) ? MD.fmtPrice(o.symbolId, o.price) : o.price}</td>
          <td><span class="badge ${statusCls}">${o.status}</span></td>
          <td class="hide-md-col muted">${T.fmtDateTime(o.time)}</td>
        </tr>`;
    }).join("");
  }

  els.orderFilter.addEventListener("change", renderOrders);

  // ---------- account ----------

  function initProfileForm() {
    $("#pf-first").value = user.first;
    $("#pf-last").value = user.last;
    $("#pf-email").value = user.email;
    $("#pf-phone").value = user.phone || "";
    const sel = $("#pf-country");
    sel.innerHTML = `<option value="" disabled>Select your country</option>` +
      COUNTRIES.map((c) => `<option value="${c}">${COUNTRY_NAMES[c]}</option>`).join("");
    sel.value = user.country && COUNTRIES.includes(user.country) ? user.country : "";

    $("#session-info").textContent = `${user.email} \u00b7 member since ${T.fmtDate(user.createdAt)}`;
  }

  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const first = $("#pf-first");
    const last = $("#pf-last");
    const phone = $("#pf-phone");
    let ok = true;

    const setErr = (input, msg) => {
      const field = input.closest(".field");
      field.classList.toggle("has-error", !!msg);
      field.querySelector(".field-error").textContent = msg || "";
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg) ok = false;
    };

    setErr(first, first.value.trim().length >= 2 ? "" : "Please enter your first name.");
    setErr(last, last.value.trim().length >= 2 ? "" : "Please enter your last name.");
    if (phone.value.trim() && !/^[+\d][\d\s\-().]{6,}$/.test(phone.value.trim())) {
      setErr(phone, "Enter a valid phone number.");
    } else {
      setErr(phone, "");
    }
    if (!ok) return;

    const btn = e.submitter || e.target.querySelector("button[type=submit]");
    T.btnLoading(btn, true);
    await new Promise((r) => setTimeout(r, 550));

    const updated = T.Store.updateProfile(user.email, {
      first: first.value.trim(),
      last: last.value.trim(),
      phone: phone.value.trim(),
      country: $("#pf-country").value
    });
    if (updated) {
      const name = `${updated.first} ${updated.last}`.trim();
      $$("[data-user-name]").forEach((el) => (el.textContent = name));
      const initials = (updated.first[0] + (updated.last[0] || "")).toUpperCase();
      $$("[data-user-initials]").forEach((el) => (el.textContent = initials));
    }
    T.btnLoading(btn, false);
    T.toast.success("Your profile has been updated.", "Saved");
  });

  function initPrefs() {
    const prefs = T.Store.data.prefs || {};
    const news = $("#pref-newsletter");
    const alerts = $("#pref-pricealerts");
    news.checked = prefs.newsletter ?? !!user.newsletter;
    alerts.checked = !!prefs.priceAlerts;
    news.addEventListener("change", () => {
      T.Store.data.prefs = { ...(T.Store.data.prefs || {}), newsletter: news.checked };
      T.Store.save();
      T.toast.info(news.checked ? "Market updates enabled." : "Market updates disabled.");
    });
    alerts.addEventListener("change", () => {
      T.Store.data.prefs = { ...(T.Store.data.prefs || {}), priceAlerts: alerts.checked };
      T.Store.save();
      T.toast.info(alerts.checked ? "Price alerts on." : "Price alerts off.");
    });
  }

  $("#reset-demo").addEventListener("click", async () => {
    const ok = await T.confirmDialog({
      title: "Reset demo environment?",
      message: "All accounts, balances, positions and history will be wiped and restored to defaults. You will be signed out.",
      confirmText: "Reset everything",
      danger: true,
      icon: "fa-rotate-left"
    });
    if (!ok) return;
    T.Auth.logout();
    T.Store.reset();
    window.location.href = "index.html";
  });

  // ---------- security ----------

  function scorePassword(v) {
    if (!v) return 0;
    let s = 0;
    if (v.length >= 8) s++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    return v.length < 8 ? Math.min(s, 1) : Math.min(4, s);
  }

  $("#password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const cur = $("#cur-password");
    const next = $("#new-password");
    const conf = $("#conf-password");
    let ok = true;

    const setErr = (input, msg) => {
      const field = input.closest(".field");
      field.classList.toggle("has-error", !!msg);
      field.querySelector(".field-error").textContent = msg || "";
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg) ok = false;
    };

    if (!cur.value) { setErr(cur, "Enter your current password."); ok = false; } else setErr(cur, "");
    if (scorePassword(next.value) < 2) { setErr(next, "Use 8+ characters with mixed case, numbers or symbols."); ok = false; } else setErr(next, "");
    if (conf.value !== next.value || !conf.value) { setErr(conf, "Passwords do not match."); ok = false; } else setErr(conf, "");
    if (!ok) return;

    const btn = e.submitter || e.target.querySelector("button[type=submit]");
    T.btnLoading(btn, true);
    await new Promise((r) => setTimeout(r, 600));

    try {
      await T.Auth.login(user.email, cur.value, false);
      T.Store.changePassword(user.email, next.value);
      T.toast.success("Password updated. Use it next time you log in.", "Security");
      cur.value = "";
      next.value = "";
      conf.value = "";
    } catch (err) {
      setErr(cur, "Current password is incorrect.");
    } finally {
      T.btnLoading(btn, false);
    }
  });

  function initTwoFA() {
    const toggle = $("#twofa-toggle");
    toggle.checked = !!(T.Store.data.prefs || {}).twofa;
    toggle.addEventListener("change", () => {
      T.Store.data.prefs = { ...(T.Store.data.prefs || {}), twofa: toggle.checked };
      T.Store.save();
      T.toast[toggle.checked ? "success" : "info"](
        toggle.checked ? "Two-factor authentication enabled." : "Two-factor authentication disabled.",
        "Security"
      );
    });
  }

  // ---------- funding ----------

  function fieldErr(input, msg) {
    const field = input.closest(".field");
    field.classList.toggle("has-error", !!msg);
    field.querySelector(".field-error").textContent = msg || "";
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  $("#deposit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amountInput = $("#dep-amount");
    const amount = parseFloat(amountInput.value);
    fieldErr(amountInput, "");
    if (!Number.isFinite(amount) || amount < 10) {
      fieldErr(amountInput, "Minimum deposit is $10.");
      return;
    }
    if (amount > 50000) {
      fieldErr(amountInput, "Maximum single deposit is $50,000.");
      return;
    }
    const method = document.querySelector('input[name="dep-method"]:checked')?.value || "Wire transfer";
    const btn = e.submitter || e.target.querySelector("button[type=submit]");
    T.btnLoading(btn, true);
    await new Promise((r) => setTimeout(r, 800));
    T.Store.adjustCash(amount);
    T.Store.addTx({ kind: "deposit", method, amount });
    T.btnLoading(btn, false);
    amountInput.value = "";
    T.toast.success(`${money(amount)} via ${method}.`, "Deposit complete");
    paintStats();
    renderTxTable();
    renderFundingTable();
  });

  $("#withdraw-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amountInput = $("#wd-amount");
    const amount = parseFloat(amountInput.value);
    fieldErr(amountInput, "");
    if (!Number.isFinite(amount) || amount < 10) {
      fieldErr(amountInput, "Minimum withdrawal is $10.");
      return;
    }
    if (amount > T.Store.data.cash) {
      fieldErr(amountInput, `You only have ${money(T.Store.data.cash)} available.`);
      return;
    }
    const method = document.querySelector('input[name="wd-method"]:checked')?.value || "Wire transfer";
    const btn = e.submitter || e.target.querySelector("button[type=submit]");
    T.btnLoading(btn, true);
    await new Promise((r) => setTimeout(r, 800));
    T.Store.adjustCash(-amount);
    T.Store.addTx({ kind: "withdrawal", method, amount, status: "pending" });
    T.btnLoading(btn, false);
    amountInput.value = "";
    T.toast.info(`${money(amount)} to ${method} is processing.`, "Withdrawal requested");
    paintStats();
    renderTxTable();
    renderFundingTable();
  });

  function renderFundingTable() {
    const rows = T.Store.data.txs.filter((tx) => tx.kind === "deposit" || tx.kind === "withdrawal");
    document.querySelector("#funding").querySelectorAll(".table-scroll").forEach((wrap) => (wrap.hidden = !rows.length));
    els.fundingBody.innerHTML = rows.map((tx) => {
      const sign = tx.kind === "deposit" ? "+" : "\u2212";
      return `
        <tr>
          <td><span class="badge ${tx.kind === "deposit" ? "badge-primary" : "badge-warn"}">${tx.kind === "deposit" ? "Deposit" : "Withdrawal"}</span></td>
          <td>${T.escapeHtml(tx.method || "\u2013")}</td>
          <td class="cell-num num ${tx.kind === "deposit" ? "positive" : "negative"}">${sign}${money(tx.amount)}</td>
          <td><span class="badge ${tx.status === "completed" ? "badge-up" : "badge-warn"}">${T.escapeHtml(tx.status)}</span></td>
          <td class="hide-md-col muted">${T.fmtDate(tx.time)}</td>
        </tr>`;
    }).join("");
  }

  // ---------- live tick ----------

  let rafPending = false;
  MD.subscribe(() => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      paintStats();
      $$("#dash-positions-body tr[data-pos]").forEach((row) => {
        const pos = T.Store.data.positions.find((p) => p.id === row.dataset.pos);
        if (!pos) return;
        const { pl, pct, cur } = posPL(pos);
        row.querySelector("[data-cur]").textContent = MD.fmtPrice(pos.symbolId, cur);
        const cell = row.querySelector("[data-pl]");
        cell.innerHTML = `${signedMoney(pl)} <small>(${T.fmtPct(pct)})</small>`;
        cell.className = `cell-num num ${pl >= 0 ? "positive" : "negative"}`;
      });
    });
  });

  // ---------- boot ----------

  showSection(window.location.hash.replace("#", "") || "overview", false);
  initProfileForm();
  initPrefs();
  initTwoFA();
  paintStats();
  renderOverviewPositions();
  renderTxTable();
  renderOrders();
  renderFundingTable();
  drawPerformance();
})();
