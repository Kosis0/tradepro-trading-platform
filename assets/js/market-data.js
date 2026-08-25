(() => {
  "use strict";

  const LEVERAGE = { forex: 100, stocks: 5, indices: 20, commodities: 20, crypto: 2 };

  const INSTRUMENTS = [
    { id: "EURUSD", symbol: "EUR/USD", name: "Euro / US Dollar", cls: "forex", base: 1.0854, dec: 5, vol: 0.0048, contract: 100000, pip: 0.0001, spreadPct: 0.00006, volBase: 12500000 },
    { id: "GBPUSD", symbol: "GBP/USD", name: "British Pound / US Dollar", cls: "forex", base: 1.2658, dec: 5, vol: 0.0052, contract: 100000, pip: 0.0001, spreadPct: 0.00007, volBase: 8200000 },
    { id: "USDJPY", symbol: "USD/JPY", name: "US Dollar / Japanese Yen", cls: "forex", base: 151.23, dec: 3, vol: 0.006, contract: 100000, pip: 0.01, spreadPct: 0.00007, volBase: 10100000 },
    { id: "AUDUSD", symbol: "AUD/USD", name: "Australian Dollar / US Dollar", cls: "forex", base: 0.6532, dec: 5, vol: 0.0065, contract: 100000, pip: 0.0001, spreadPct: 0.00009, volBase: 5700000 },
    { id: "USDCAD", symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", cls: "forex", base: 1.3589, dec: 5, vol: 0.005, contract: 100000, pip: 0.0001, spreadPct: 0.00009, volBase: 6300000 },
    { id: "USDCHF", symbol: "USD/CHF", name: "US Dollar / Swiss Franc", cls: "forex", base: 0.8842, dec: 5, vol: 0.0049, contract: 100000, pip: 0.0001, spreadPct: 0.0001, volBase: 4900000 },

    { id: "AAPL", symbol: "AAPL", name: "Apple Inc.", cls: "stocks", base: 175.34, dec: 2, vol: 0.014, contract: 1, pip: 0.01, spreadPct: 0.0003, volBase: 52000000 },
    { id: "MSFT", symbol: "MSFT", name: "Microsoft Corp.", cls: "stocks", base: 420.72, dec: 2, vol: 0.013, contract: 1, pip: 0.01, spreadPct: 0.0003, volBase: 24000000 },
    { id: "NVDA", symbol: "NVDA", name: "NVIDIA Corp.", cls: "stocks", base: 903.56, dec: 2, vol: 0.031, contract: 1, pip: 0.01, spreadPct: 0.0005, volBase: 310000000 },
    { id: "TSLA", symbol: "TSLA", name: "Tesla Inc.", cls: "stocks", base: 172.63, dec: 2, vol: 0.038, contract: 1, pip: 0.01, spreadPct: 0.0005, volBase: 98000000 },
    { id: "AMZN", symbol: "AMZN", name: "Amazon.com Inc.", cls: "stocks", base: 185.25, dec: 2, vol: 0.017, contract: 1, pip: 0.01, spreadPct: 0.0004, volBase: 38000000 },
    { id: "META", symbol: "META", name: "Meta Platforms Inc.", cls: "stocks", base: 496.11, dec: 2, vol: 0.018, contract: 1, pip: 0.01, spreadPct: 0.0004, volBase: 18000000 },

    { id: "SPX", symbol: "US 500", name: "S&P 500 Index", cls: "indices", base: 5218.75, dec: 2, vol: 0.008, contract: 1, pip: 1, spreadPct: 0.0002, volBase: 2100000 },
    { id: "NASDAQ", symbol: "US Tech 100", name: "Nasdaq 100 Index", cls: "indices", base: 16245.3, dec: 2, vol: 0.011, contract: 1, pip: 1, spreadPct: 0.00025, volBase: 3500000 },
    { id: "DOW", symbol: "US 30", name: "Dow Jones Industrial Average", cls: "indices", base: 38459.2, dec: 2, vol: 0.007, contract: 1, pip: 1, spreadPct: 0.00022, volBase: 1800000 },
    { id: "FTSE", symbol: "UK 100", name: "FTSE 100 Index", cls: "indices", base: 7921.6, dec: 2, vol: 0.007, contract: 1, pip: 1, spreadPct: 0.00028, volBase: 1200000 },
    { id: "DAX", symbol: "Germany 40", name: "DAX Index", cls: "indices", base: 18045.9, dec: 2, vol: 0.009, contract: 1, pip: 1, spreadPct: 0.00026, volBase: 950000 },
    { id: "NIKKEI", symbol: "Japan 225", name: "Nikkei 225 Index", cls: "indices", base: 39523.4, dec: 2, vol: 0.011, contract: 1, pip: 1, spreadPct: 0.00032, volBase: 1100000 },

    { id: "XAUUSD", symbol: "Gold", name: "Gold Spot / US Dollar", cls: "commodities", base: 2184.5, dec: 2, vol: 0.0095, contract: 100, pip: 0.1, spreadPct: 0.00035, volBase: 185000 },
    { id: "XAGUSD", symbol: "Silver", name: "Silver Spot / US Dollar", cls: "commodities", base: 24.682, dec: 3, vol: 0.016, contract: 5000, pip: 0.01, spreadPct: 0.0007, volBase: 92000 },
    { id: "WTI", symbol: "Crude Oil WTI", name: "West Texas Intermediate Crude", cls: "commodities", base: 81.45, dec: 2, vol: 0.023, contract: 1000, pip: 0.01, spreadPct: 0.0006, volBase: 410000 },
    { id: "NGAS", symbol: "Natural Gas", name: "Henry Hub Natural Gas", cls: "commodities", base: 1.824, dec: 3, vol: 0.042, contract: 10000, pip: 0.001, spreadPct: 0.0012, volBase: 120000 },
    { id: "COPPER", symbol: "Copper", name: "Copper Futures", cls: "commodities", base: 4.124, dec: 3, vol: 0.017, contract: 25000, pip: 0.001, spreadPct: 0.0008, volBase: 65000 },

    { id: "BTCUSD", symbol: "BTC/USD", name: "Bitcoin", cls: "crypto", base: 68452, dec: 2, vol: 0.031, contract: 1, pip: 1, spreadPct: 0.0012, volBase: 28500000000 },
    { id: "ETHUSD", symbol: "ETH/USD", name: "Ethereum", cls: "crypto", base: 3524.6, dec: 2, vol: 0.036, contract: 1, pip: 0.1, spreadPct: 0.0015, volBase: 15200000000 },
    { id: "SOLUSD", symbol: "SOL/USD", name: "Solana", cls: "crypto", base: 185.42, dec: 2, vol: 0.062, contract: 1, pip: 0.01, spreadPct: 0.002, volBase: 8500000000 },
    { id: "XRPUSD", symbol: "XRP/USD", name: "XRP", cls: "crypto", base: 0.6234, dec: 4, vol: 0.048, contract: 1, pip: 0.0001, spreadPct: 0.0022, volBase: 2100000000 },
    { id: "ADAUSD", symbol: "ADA/USD", name: "Cardano", cls: "crypto", base: 0.4521, dec: 4, vol: 0.052, contract: 1, pip: 0.0001, spreadPct: 0.0024, volBase: 1800000000 }
  ];

  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(rand = Math.random) {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const live = new Map();
  const subs = new Set();
  let timer = null;

  INSTRUMENTS.forEach((inst) => {
    const r = mulberry32(hashStr(inst.id));
    const dayOffset = (r() * 2 - 1) * inst.vol * 2.2;
    const price = inst.base;
    const prevClose = +(price / (1 + dayOffset)).toFixed(inst.dec + 1);
    live.set(inst.id, {
      inst,
      price,
      prevClose,
      high: Math.max(price, prevClose) * (1 + r() * inst.vol * 0.55),
      low: Math.min(price, prevClose) * (1 - r() * inst.vol * 0.55),
      dir: 0,
      lastTickAt: Date.now()
    });
  });

  function notify(changedList) {
    subs.forEach((fn) => {
      try { fn(changedList); } catch (err) { console.error(err); }
    });
  }

  function tick() {
    const changed = [];
    live.forEach((s) => {
      const { inst } = s;
      let ret = gauss() * inst.vol * 0.055;
      if (Math.random() < 0.015) ret *= 3.2;
      ret += (inst.base - s.price) / inst.base * 0.002;
      s.price = Math.max(0.00001, s.price * (1 + ret));
      if (s.price > s.high) s.high = s.price;
      if (s.price < s.low) s.low = s.price;
      s.dir = ret > 0 ? 1 : ret < 0 ? -1 : 0;
      changed.push(s);
    });
    if (changed.length) notify(changed);
  }

  function ensureEngine() {
    if (timer) return;
    timer = setInterval(tick, 1300);
  }

  const get = (id) => {
    ensureEngine();
    return live.get(id) || null;
  };

  const bySymbol = (symbol) =>
    INSTRUMENTS.find(
      (i) => i.symbol.toLowerCase() === String(symbol).toLowerCase().replace(/-/g, "/")
    ) || null;

  const list = (cls) => (cls ? INSTRUMENTS.filter((i) => i.cls === cls) : INSTRUMENTS.slice());

  const subscribe = (fn) => {
    ensureEngine();
    subs.add(fn);
    return () => subs.delete(fn);
  };

  const priceOf = (id) => {
    const s = get(id);
    return s ? s.price : 0;
  };

  const change = (id) => {
    const s = get(id);
    return s ? s.price - s.prevClose : 0;
  };

  const changePct = (id) => {
    const s = get(id);
    if (!s || !s.prevClose) return 0;
    return ((s.price - s.prevClose) / s.prevClose) * 100;
  };

  const spreadAbs = (id) => {
    const s = get(id);
    if (!s) return 0;
    return s.inst.spreadPct * s.price;
  };

  const bidAsk = (id) => {
    const half = spreadAbs(id) / 2;
    const p = priceOf(id);
    return { bid: p - half, ask: p + half, mid: p };
  };

  const leverageOf = (id) => {
    const s = get(id);
    return s ? LEVERAGE[s.inst.cls] || 1 : 1;
  };

  const fmtPrice = (id, v) => {
    const s = typeof id === "object" ? id : get(id);
    const dec = s ? (s.inst ? s.inst.dec : s.dec) : 2;
    const n = Number(v) || 0;
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
  };

  const volumeLabel = (id) => {
    const inst = typeof id === "object" && id.base !== undefined ? id : (get(id)?.inst ?? null);
    if (!inst) return "\u2013";
    const v = inst.volBase;
    if (v >= 1e12) return (v / 1e12).toFixed(1) + "T";
    if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
    return String(v);
  };

  function history(id, tfSec, count = 160) {
    const state = get(id);
    if (!state) return { candles: [], volume: [] };
    const inst = state.inst;
    const rand = mulberry32(hashStr(inst.id + ":" + tfSec));
    const nowSec = Math.floor(Date.now() / 1000);
    const startSec = nowSec - (nowSec % tfSec);

    const closes = [];
    let p = state.prevClose;
    for (let i = 0; i < count; i++) {
      let step = gauss(rand) * inst.vol * Math.sqrt(tfSec / 86400) * 0.85;
      if (rand() < 0.02) step *= 2.6;
      p = Math.max(0.00001, p * (1 + step));
      closes.push(p);
    }

    const driftToLive = state.price / closes[closes.length - 1];
    const candles = [];
    const volume = [];
    for (let i = 0; i < count; i++) {
      const close = closes[i] * (1 + ((driftToLive - 1) * (i + 1)) / count);
      const open = i === 0 ? close * (1 - gauss(rand) * inst.vol * 0.12) : candles[i - 1].close;
      const hi = Math.max(open, close) * (1 + Math.abs(gauss(rand)) * inst.vol * 0.08);
      const lo = Math.min(open, close) * (1 - Math.abs(gauss(rand)) * inst.vol * 0.08);
      const time = startSec - (count - 1 - i) * tfSec;
      candles.push({ time, open, high: hi, low: lo, close });
      volume.push({
        time,
        value: Math.floor(inst.volBase * (0.25 + rand() * 1.1) * (tfSec / 3600)),
        color: close >= open ? "rgba(23, 128, 63, 0.45)" : "rgba(187, 58, 48, 0.45)"
      });
    }

    const last = candles[candles.length - 1];
    last.close = state.price;
    last.high = Math.max(last.high, state.price);
    last.low = Math.min(last.low, state.price);

    return { candles, volume };
  }

  window.MarketData = {
    INSTRUMENTS,
    CLASSES: Object.keys(LEVERAGE),
    LEVERAGE,
    get, bySymbol, list, subscribe, tick,
    priceOf, change, changePct, bidAsk, spreadAbs, leverageOf,
    fmtPrice, volumeLabel, history
  };
})();
