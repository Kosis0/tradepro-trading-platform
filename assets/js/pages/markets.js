(() => {
  "use strict";

  const T = window.TP;
  const MD = window.MarketData;
  if (!T || !MD) return;

  const { $, $$ } = T;

  const PAGE_SIZE = 10;
  const CLASSES = ["all", "forex", "stocks", "indices", "commodities", "crypto"];
  const state = { cls: "all", query: "", sort: "name", watchOnly: false, page: 1 };

  const SORTERS = {
    name: (a, b) => a.symbol.localeCompare(b.symbol),
    price: (a, b) => MD.priceOf(b.id) - MD.priceOf(a.id),
    change: (a, b) => Math.abs(MD.changePct(b.id)) - Math.abs(MD.changePct(a.id)),
    volume: (a, b) => b.volBase - a.volBase
  };

  const bodyEl = $("#markets-body");
  const tableEl = document.querySelector(".table-card table");
  const emptyEl = $("#empty-state");
  const pageInfo = $("#page-info");
  const pageNumbers = $("#page-numbers");
  const prevBtn = $("#prev-page");
  const nextBtn = $("#next-page");

  let cellCache = new Map();

  function filtered() {
    let items = MD.list();
    if (state.cls !== "all") items = items.filter((i) => i.cls === state.cls);
    if (state.query) {
      const q = state.query.toLowerCase();
      items = items.filter(
        (i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
      );
    }
    if (state.watchOnly) items = items.filter((i) => T.Store.isWatched(i.id));
    return [...items].sort(SORTERS[state.sort] || SORTERS.name);
  }

  function rowHtml(inst) {
    const watched = T.Store.isWatched(inst.id);
    const pct = MD.changePct(inst.id);
    const s = MD.get(inst.id);
    return `
      <tr data-id="${inst.id}" tabindex="0" aria-label="${T.escapeHtml(inst.name)}">
        <td><strong>${T.escapeHtml(inst.symbol)}</strong><br><small class="muted">${T.escapeHtml(inst.name)}</small></td>
        <td class="cell-num num" data-cell="price">${MD.fmtPrice(inst.id, s.price)}</td>
        <td class="cell-num"><span class="badge ${pct >= 0 ? "badge-up" : "badge-down"} num" data-cell="chg">${T.fmtPct(pct)}</span></td>
        <td class="cell-num num muted hide-md" data-cell="hilo">${MD.fmtPrice(inst.id, s.high)} / ${MD.fmtPrice(inst.id, s.low)}</td>
        <td class="cell-num num muted hide-md">${MD.volumeLabel(inst)}</td>
        <td class="cell-num">
          <div class="row-actions">
            <button type="button" class="star-btn${watched ? " watched" : ""}" data-star="${inst.id}" aria-pressed="${watched}" aria-label="${watched ? `Remove ${T.escapeHtml(inst.symbol)} from watchlist` : `Add ${T.escapeHtml(inst.symbol)} to watchlist`}"><i class="fa-solid fa-star"></i></button>
            <a class="btn btn-primary btn-sm" href="trade.html?symbol=${inst.id}">Trade</a>
          </div>
        </td>
      </tr>`;
  }

  function cacheCells() {
    cellCache.clear();
    $$("#markets-body tr[data-id]").forEach((row) => {
      cellCache.set(row.dataset.id, {
        price: row.querySelector('[data-cell="price"]'),
        chg: row.querySelector('[data-cell="chg"]')
      });
    });
  }

  function flash(el, dir) {
    el.classList.remove("price-flash-up", "price-flash-down");
    void el.offsetWidth;
    el.classList.add(dir >= 0 ? "price-flash-up" : "price-flash-down");
  }

  function render() {
    const items = filtered();
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);

    emptyEl.hidden = total > 0;
    if (tableEl) tableEl.hidden = !total;

    pageNumbers.innerHTML = "";
    for (let p = 1; p <= pages; p++) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(p);
      b.dataset.page = String(p);
      if (p === state.page) b.setAttribute("aria-current", "page");
      pageNumbers.appendChild(b);
    }
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= pages;

    if (!total) {
      pageInfo.textContent = state.watchOnly && !T.Store.data.watchlist.length
        ? "Your watchlist is empty — tap the star on any instrument to pin it here."
        : "No instruments match your filters.";
      cellCache.clear();
      return;
    }

    const startIdx = (state.page - 1) * PAGE_SIZE;
    const slice = items.slice(startIdx, startIdx + PAGE_SIZE);
    bodyEl.innerHTML = slice.map(rowHtml).join("");
    cacheCells();

    pageInfo.textContent = `Showing ${startIdx + 1}\u2013${startIdx + slice.length} of ${total} instrument${total === 1 ? "" : "s"}`;
  }

  function navigate(id) {
    window.location.href = `trade.html?symbol=${encodeURIComponent(id)}`;
  }

  function setClass(cls) {
    state.cls = cls;
    state.page = 1;
    $$("#class-tabs .seg-btn").forEach((btn) =>
      btn.setAttribute("aria-selected", String(btn.dataset.class === cls))
    );
    render();
  }

  let rafPending = false;
  MD.subscribe(() => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      cellCache.forEach((cells, id) => {
        const priceCell = cells.price;
        if (!priceCell.isConnected) return;
        const cur = MD.priceOf(id);
        const old = Number(priceCell.dataset.prev ?? cur);
        if (cur !== old) {
          priceCell.textContent = MD.fmtPrice(id, cur);
          flash(priceCell, cur - old);
          priceCell.dataset.prev = String(cur);
        }
        const pct = MD.changePct(id);
        cells.chg.className = `badge ${pct >= 0 ? "badge-up" : "badge-down"} num`;
        cells.chg.textContent = T.fmtPct(pct);
      });
    });
  });

  $("#class-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-class]");
    if (!btn) return;
    const cls = btn.dataset.class;
    setClass(cls);
    try {
      const url = cls === "all" ? window.location.pathname : `#${cls}`;
      window.history.replaceState(null, "", url);
    } catch (_) {}
  });

  $("#market-search").addEventListener("input", T.debounce((e) => {
    state.query = e.target.value.trim();
    state.page = 1;
    render();
  }, 180));

  $("#sort-by").addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });

  $("#watch-filter").addEventListener("change", (e) => {
    state.watchOnly = e.target.value === "watch";
    state.page = 1;
    render();
  });

  bodyEl.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const star = e.target.closest("[data-star]");
    if (star) {
      const id = star.dataset.star;
      const result = T.Store.toggleWatch(id);
      star.classList.toggle("watched", result === "added");
      star.setAttribute("aria-pressed", String(result === "added"));
      const inst = MD.get(id)?.inst;
      if (result === "added") T.toast.success(`${inst?.symbol || id} added to your watchlist.`, "Watchlist updated");
      return;
    }
    const row = e.target.closest("tr[data-id]");
    if (row) navigate(row.dataset.id);
  });

  bodyEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest("tr[data-id]");
    if (row) {
      e.preventDefault();
      navigate(row.dataset.id);
    }
  });

  prevBtn.addEventListener("click", () => { state.page--; render(); });
  nextBtn.addEventListener("click", () => { state.page++; render(); });
  pageNumbers.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (!btn) return;
    state.page = Number(btn.dataset.page);
    render();
  });

  function applyHash() {
    const cls = window.location.hash.replace("#", "");
    if (CLASSES.includes(cls)) setClass(cls);
  }

  window.addEventListener("hashchange", applyHash);

  applyHash();
  render();
})();
