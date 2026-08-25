(() => {
  "use strict";

  const LS_KEY = "tp_state_v1";
  const SESSION_KEY = "tp_session_v1";
  const THEME_KEY = "tp_theme";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const uuid = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

  function hashPw(str, salt) {
    const s = salt + "|" + str + "|" + salt;
    let h1 = 0xdeadbeef ^ s.length;
    let h2 = 0x41c6ce57 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (((h2 >>> 0) * 4294967296 + (h1 >>> 0)) % Number.MAX_SAFE_INTEGER).toString(36);
  }

  const escapeHtml = (str) =>
    String(str).replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const debounce = (fn, ms = 200) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const fmtMoney = (v) => {
    const n = Number(v) || 0;
    return (n < 0 ? "-" : "") + usd.format(Math.abs(n));
  };

  const fmtSignedMoney = (v) => (v > 0 ? "+" : v < 0 ? "\u2212" : "") + fmtMoney(Math.abs(v)).replace("$", "$");

  const fmtNum = (v, min = 0, max = 2) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max }).format(v);

  const fmtPct = (v, dec = 2) => (v > 0 ? "+" : "") + v.toFixed(dec) + "%";

  const fmtDate = (ts) =>
    new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const fmtDateTime = (ts) =>
    new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const timeAgo = (ts) => {
    const diff = Math.max(1, (Date.now() - ts) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  };

  function seedState() {
    const now = Date.now();
    const day = 86400000;
    return {
      users: [
        {
          email: "demo@tradepro.com",
          first: "Demo",
          last: "Trader",
          salt: "tp-demo-salt",
          hash: hashPw("Demo1234!", "tp-demo-salt"),
          country: "US",
          phone: "",
          newsletter: true,
          verified: true,
          createdAt: now - 90 * day
        }
      ],
      cash: 25000,
      startEquity: 25000,
      positions: [],
      orders: [
        { id: uuid(), symbolId: "EURUSD", symbol: "EUR/USD", side: "buy", lots: 1.5, type: "market", price: 1.0849, status: "filled", time: now - 2 * day },
        { id: uuid(), symbolId: "XAUUSD", symbol: "Gold", side: "buy", lots: 0.25, type: "market", price: 2161.2, status: "filled", time: now - 3 * day },
        { id: uuid(), symbolId: "TSLA", symbol: "Tesla", side: "sell", lots: 40, type: "limit", price: 178.4, status: "filled", time: now - 5 * day },
        { id: uuid(), symbolId: "BTCUSD", symbol: "Bitcoin", side: "buy", lots: 0.05, type: "market", price: 66980.0, status: "cancelled", time: now - 6 * day }
      ],
      txs: [
        { id: uuid(), kind: "deposit", method: "Wire transfer", amount: 15000, status: "completed", time: now - 88 * day },
        { id: uuid(), kind: "deposit", method: "Visa •• 4242", amount: 10000, status: "completed", time: now - 61 * day },
        { id: uuid(), kind: "profit", method: "Trading P/L", amount: 1245.5, status: "completed", time: now - 12 * day },
        { id: uuid(), kind: "withdrawal", method: "Wire transfer", amount: 500, status: "pending", time: now - 1 * day }
      ],
      watchlist: ["EURUSD", "XAUUSD", "BTCUSD", "AAPL", "SPX"],
      prefs: {}
    };
  }

  let state = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      state = raw ? JSON.parse(raw) : null;
    } catch (_) {
      state = null;
    }
    if (!state || !Array.isArray(state.users)) state = seedState();
    if (typeof state.cash !== "number") state.cash = 25000;
    if (!Array.isArray(state.positions)) state.positions = [];
    if (!Array.isArray(state.orders)) state.orders = [];
    if (!Array.isArray(state.txs)) state.txs = [];
    if (!Array.isArray(state.watchlist)) state.watchlist = [];
    if (!state.startEquity) state.startEquity = state.cash;
  }

  const save = () => localStorage.setItem(LS_KEY, JSON.stringify(state));
  const saveSoon = debounce(save, 120);

  const Store = {
    get data() { return state; },
    save,
    reset() {
      localStorage.removeItem(LS_KEY);
      loadState();
      save();
    },
    findUser(email) {
      const e = String(email || "").trim().toLowerCase();
      return state.users.find((u) => u.email === e) || null;
    },
    createUser({ first, last, email, password, country, phone, newsletter }) {
      const salt = uuid();
      const user = {
        email: email.trim().toLowerCase(),
        first: first.trim(),
        last: last.trim(),
        salt,
        hash: hashPw(password, salt),
        country: country || "",
        phone: phone || "",
        newsletter: !!newsletter,
        verified: false,
        createdAt: Date.now()
      };
      state.users.push(user);
      save();
      return user;
    },
    markVerified(email) {
      const u = Store.findUser(email);
      if (u) { u.verified = true; save(); }
      return u;
    },
    updateProfile(email, patch) {
      const u = Store.findUser(email);
      if (!u) return null;
      Object.assign(u, patch);
      save();
      return u;
    },
    changePassword(email, newPassword) {
      const u = Store.findUser(email);
      if (!u) return false;
      u.salt = uuid();
      u.hash = hashPw(newPassword, u.salt);
      save();
      return true;
    },
    adjustCash(delta) {
      state.cash = Math.round((state.cash + delta) * 100) / 100;
      saveSoon();
    },
    addPosition(p) {
      state.positions.push({ id: uuid(), openedAt: Date.now(), ...p });
      save();
    },
    removePosition(id) {
      const idx = state.positions.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      return state.positions.splice(idx, 1)[0];
    },
    addOrder(o) {
      const order = { id: uuid(), status: "filled", time: Date.now(), ...o };
      state.orders.unshift(order);
      if (state.orders.length > 100) state.orders.length = 100;
      save();
      return order;
    },
    setOrderStatus(id, status) {
      const o = state.orders.find((x) => x.id === id);
      if (o) { o.status = status; save(); }
    },
    addTx(tx) {
      state.txs.unshift({ id: uuid(), status: "completed", time: Date.now(), ...tx });
      if (state.txs.length > 100) state.txs.length = 100;
      save();
    },
    toggleWatch(id) {
      const i = state.watchlist.indexOf(id);
      if (i === -1) state.watchlist.push(id);
      else state.watchlist.splice(i, 1);
      save();
      return i !== -1 ? "removed" : "added";
    },
    isWatched(id) { return state.watchlist.includes(id); }
  };

  const Session = {
    get() {
      try {
        return (
          JSON.parse(localStorage.getItem(SESSION_KEY)) ||
          JSON.parse(sessionStorage.getItem(SESSION_KEY))
        );
      } catch (_) {
        return null;
      }
    },
    create(email, remember) {
      const payload = JSON.stringify({ email, at: Date.now() });
      if (remember) localStorage.setItem(SESSION_KEY, payload);
      else sessionStorage.setItem(SESSION_KEY, payload);
    },
    clear() {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }
  };

  const Auth = {
    current() {
      const s = Session.get();
      if (!s) return null;
      return Store.findUser(s.email);
    },
    async login(email, password, remember) {
      const user = Store.findUser(email);
      if (!user) throw new Error("No account found with that email address.");
      if (user.hash !== hashPw(password, user.salt)) throw new Error("Incorrect email or password.");
      if (!user.verified) {
        const err = new Error("Your email is not verified yet.");
        err.code = "UNVERIFIED";
        err.email = user.email;
        throw err;
      }
      Session.create(user.email, !!remember);
      return user;
    },
    register(payload) {
      if (Store.findUser(payload.email)) throw new Error("An account with this email already exists.");
      return Store.createUser(payload);
    },
    logout() {
      Session.clear();
    }
  };

  function initThemeFromStorage() {
    let theme = null;
    try { theme = localStorage.getItem(THEME_KEY); } catch (_) {}
    if (theme !== "dark" && theme !== "light") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", theme);
    return theme;
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
  }

  const toastRegion = () => {
    let region = $(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    return region;
  };

  const ICONS = { success: "fa-circle-check", error: "fa-circle-xmark", warning: "fa-triangle-exclamation", info: "fa-circle-info" };

  function showToast(type, message, title) {
    const region = toastRegion();
    while (region.children.length >= 4) region.firstChild.remove();
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    const t = title || ({ success: "Success", error: "Something went wrong", warning: "Heads up", info: "Did you know" }[type] || "");
    el.innerHTML = `
      <i class="toast-icon fa-solid ${ICONS[type] || ICONS.info}" aria-hidden="true"></i>
      <div class="toast-body">
        ${t ? `<strong>${escapeHtml(t)}</strong>` : ""}
        <span>${escapeHtml(message)}</span>
      </div>
      <button class="toast-close" aria-label="Dismiss notification"><i class="fa-solid fa-xmark"></i></button>`;
    const kill = () => {
      el.classList.add("leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 400);
    };
    el.querySelector(".toast-close").addEventListener("click", kill);
    region.appendChild(el);
    setTimeout(kill, 4500);
  }

  const toast = {
    success: (msg, title) => showToast("success", msg, title),
    error: (msg, title) => showToast("error", msg, title),
    warning: (msg, title) => showToast("warning", msg, title),
    info: (msg, title) => showToast("info", msg, title)
  };

  function confirmDialog({ title = "Are you sure?", message = "", confirmText = "Confirm", cancelText = "Cancel", danger = false, icon = "" } = {}) {
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-icon ${danger ? "danger" : "primary"}"><i class="fa-solid ${icon || (danger ? "fa-triangle-exclamation" : "fa-circle-question")}"></i></div>
          <h3 id="modal-title">${escapeHtml(title)}</h3>
          <p>${escapeHtml(message)}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-act="cancel">${escapeHtml(cancelText)}</button>
            <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${escapeHtml(confirmText)}</button>
          </div>
        </div>`;
      const done = (val) => {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        resolve(val);
      };
      const onKey = (e) => {
        if (e.key === "Escape") done(false);
        if (e.key === "Tab") {
          const focusables = overlay.querySelectorAll("button");
          const list = [focusables[0], focusables[1]];
          if (document.activeElement === list[list.length - 1]) {
            e.preventDefault();
            list[0].focus();
          } else if (document.activeElement === list[0]) {
            e.preventDefault();
            list[1].focus();
          }
        }
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) done(false);
        if (e.target.closest('[data-act="cancel"]')) done(false);
        if (e.target.closest('[data-act="ok"]')) done(true);
      });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(overlay);
      overlay.querySelector('[data-act="ok"]').focus();
    });
  }

  function btnLoading(btn, on) {
    if (!btn) return;
    btn.classList.toggle("is-loading", on);
    btn.disabled = on;
  }

  function initNav() {
    const toggle = $(".nav-toggle");
    const nav = $("#site-nav");
    if (!toggle || !nav) return;
    const setOpen = (open) => {
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open && window.innerWidth <= 920 ? "hidden" : "";
    };
    toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("nav-open")));
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) setOpen(false);
    });
    document.addEventListener("click", (e) => {
      if (
        document.body.classList.contains("nav-open") &&
        !e.target.closest(".site-header")
      ) setOpen(false);
    });
    window.addEventListener("resize", debounce(() => {
      if (window.innerWidth > 920) setOpen(false);
    }, 150));
  }

  function initUserMenu() {
    $$(".user-menu").forEach((menu) => {
      const chip = menu.querySelector(".user-chip");
      if (!chip) return;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = menu.classList.toggle("open");
        chip.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("click", (e) => {
        if (!menu.contains(e.target)) menu.classList.remove("open");
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") menu.classList.remove("open");
      });
    });
  }

  function applyAuthUI() {
    const user = Auth.current();
    document.body.classList.toggle("is-authed", !!user);
    if (!user) return;
    const initials = (user.first[0] + (user.last[0] || "")).toUpperCase();
    const name = `${user.first} ${user.last}`.trim();
    $$("[data-user-name]").forEach((el) => (el.textContent = name));
    $$("[data-user-initials]").forEach((el) => (el.textContent = initials));
    $$("[data-user-email]").forEach((el) => (el.textContent = user.email));
  }

  function wireGlobalActions() {
    $$('[data-action="logout"]').forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        Auth.logout();
        toast.info("You have been signed out.", "See you soon");
        setTimeout(() => (window.location.href = "index.html"), 600);
      })
    );
    const themeBtn = $("#theme-toggle");
    if (themeBtn) {
      themeBtn.setAttribute("aria-pressed", String(document.documentElement.getAttribute("data-theme") === "dark"));
      themeBtn.addEventListener("click", () => {
        toggleTheme();
        themeBtn.setAttribute("aria-pressed", String(document.documentElement.getAttribute("data-theme") === "dark"));
      });
    }
  }

  function requireAuth() {
    const user = Auth.current();
    if (!user) {
      toast.warning("Please sign in to continue.", "Sign in required");
      setTimeout(() => (window.location.href = "login.html"), 700);
      return null;
    }
    return user;
  }

  function boot() {
    loadState();
    initThemeFromStorage();
    applyAuthUI();
    initNav();
    initUserMenu();
    wireGlobalActions();
    $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.TP = {
    $, $$, uuid, clamp, debounce, escapeHtml,
    fmtMoney, fmtSignedMoney, fmtNum, fmtPct, fmtDate, fmtDateTime, timeAgo,
    Store, Session, Auth,
    toast, confirmDialog, btnLoading, requireAuth
  };
})();
