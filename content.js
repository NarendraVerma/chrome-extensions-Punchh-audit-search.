(() => {
  if (window.__globalTableSearcherInitialized) return;
  window.__globalTableSearcherInitialized = true;

  const SEARCH_UI_ID = "gts-panel";
  const LAUNCHER_ID = "gts-launcher";
  const HIGHLIGHT_CLASS = "gts-highlight-match";
  const PANEL_STORAGE_KEY = "gts-panel-state-v1";
  const SEARCH_SESSION_KEY = "gts-active-search-v1";

  const DEFAULTS = {
    nextSelector: 'a[rel="next"], li.next a, a.next, button.next, [aria-label*="Next"], .pagination-next',
    tableSelector: "table tbody tr",
    delayMs: 900,
    maxPages: 500
  };

  let isSearching = false;
  let cancelSearch = false;

  injectStyles();
  ensurePanelInjected();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensurePanelInjected, { once: true });
  }

  const panelObserver = new MutationObserver(() => {
    if (!document.getElementById(SEARCH_UI_ID) || !document.getElementById(LAUNCHER_ID)) {
      ensurePanelInjected();
    }
  });
  panelObserver.observe(document.documentElement, { childList: true, subtree: true });

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #${SEARCH_UI_ID} {
        position: fixed;
        right: 16px;
        top: 16px;
        z-index: 2147483647;
        width: 300px;
        padding: 10px;
        border-radius: 10px;
        background: rgba(20, 20, 20, 0.95);
        color: #f7f7f7;
        font-family: Arial, sans-serif;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
      }
      #${SEARCH_UI_ID} * {
        box-sizing: border-box;
      }
      #${SEARCH_UI_ID} label {
        display: block;
        font-size: 12px;
        margin: 8px 0 4px;
      }
      #${SEARCH_UI_ID} input {
        width: 100%;
        padding: 7px 8px;
        border: 1px solid #555;
        border-radius: 6px;
        background: #222;
        color: #fff;
      }
      #${SEARCH_UI_ID} .gts-row {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      #${SEARCH_UI_ID} button {
        flex: 1;
        padding: 8px;
        border: none;
        border-radius: 6px;
        background: #0d6efd;
        color: #fff;
        cursor: pointer;
      }
      #${SEARCH_UI_ID} button.gts-stop {
        background: #b02a37;
      }
      #${SEARCH_UI_ID} button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      #${SEARCH_UI_ID} .gts-status {
        margin-top: 10px;
        font-size: 12px;
        min-height: 16px;
      }
      #${SEARCH_UI_ID} .gts-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }
      #${SEARCH_UI_ID} .gts-header strong {
        flex: 1;
        line-height: 1.25;
      }
      #${SEARCH_UI_ID} button.gts-hide-btn {
        flex: 0 0 auto;
        padding: 4px 10px;
        font-size: 12px;
        background: #444;
      }
      #${LAUNCHER_ID} {
        position: fixed;
        right: 16px;
        top: 16px;
        z-index: 2147483646;
        padding: 8px 12px;
        border: none;
        border-radius: 8px;
        background: #0d6efd;
        color: #fff;
        font-family: Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }
      #${LAUNCHER_ID}:hover {
        background: #0b5ed7;
      }
      .${HIGHLIGHT_CLASS} {
        outline: 2px solid #ffeb3b !important;
        background: rgba(255, 235, 59, 0.2) !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function injectPanel() {
    if (!document.body) return;
    if (document.getElementById(SEARCH_UI_ID) && document.getElementById(LAUNCHER_ID)) return;
    document.getElementById(SEARCH_UI_ID)?.remove();
    document.getElementById(LAUNCHER_ID)?.remove();

    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.id = LAUNCHER_ID;
    launcher.textContent = "Audit search";
    launcher.setAttribute("aria-label", "Open Punchh audit log search helper");
    launcher.setAttribute("aria-expanded", "false");
    document.body.appendChild(launcher);

    const panel = document.createElement("div");
    panel.id = SEARCH_UI_ID;
    panel.setAttribute("aria-hidden", "true");
    panel.style.display = "none";
    panel.innerHTML = `
      <div class="gts-header">
        <strong>Punchh Audit log search helper</strong>
        <button type="button" id="gts-hide" class="gts-hide-btn">Hide</button>
      </div>
      <label for="gts-keyword">Keyword</label>
      <input id="gts-keyword" type="text" placeholder="e.g. MassGifting" />

      <label for="gts-delay">Delay per page (ms)</label>
      <input id="gts-delay" type="number" value="${DEFAULTS.delayMs}" min="100" step="100" />

      <div class="gts-row">
        <button id="gts-start">Start Search</button>
        <button id="gts-stop" class="gts-stop" disabled>Stop</button>
      </div>
      <div id="gts-status" class="gts-status">Idle</div>
    `;

    document.body.appendChild(panel);

    restorePanelState(panel);
    wirePanelPersistence(panel);

    const hideBtn = panel.querySelector("#gts-hide");
    launcher.addEventListener("click", () => showSearchPanel(panel, launcher));
    hideBtn.addEventListener("click", () => hideSearchPanel(panel, launcher));

    const startBtn = panel.querySelector("#gts-start");
    const stopBtn = panel.querySelector("#gts-stop");

    startBtn.addEventListener("click", async () => {
      await startSearchFromPanel(panel, false);
    });

    stopBtn.addEventListener("click", () => {
      cancelSearch = true;
      clearActiveSearchSession();
      setStatus("Stopping after current page...");
    });

    maybeResumeActiveSearch(panel, launcher);
  }

  function showSearchPanel(panel, launcher) {
    panel.style.display = "block";
    panel.setAttribute("aria-hidden", "false");
    launcher.style.display = "none";
    launcher.setAttribute("aria-expanded", "true");
  }

  function hideSearchPanel(panel, launcher) {
    panel.style.display = "none";
    panel.setAttribute("aria-hidden", "true");
    launcher.style.display = "";
    launcher.setAttribute("aria-expanded", "false");
  }

  async function startSearchFromPanel(panel, isAutoResume) {
    const startBtn = panel.querySelector("#gts-start");
    const stopBtn = panel.querySelector("#gts-stop");
    if (!startBtn || !stopBtn || isSearching) return;

    const activeSession = getActiveSearchSession();
    const keyword =
      isAutoResume && activeSession?.keyword
        ? String(activeSession.keyword).trim()
        : panel.querySelector("#gts-keyword").value.trim();
    const delayMs =
      isAutoResume && Number(activeSession?.delayMs)
        ? Number(activeSession.delayMs)
        : Number(panel.querySelector("#gts-delay").value) || DEFAULTS.delayMs;
    const effectiveNextSelector = DEFAULTS.nextSelector;
    const effectiveRowSelector = DEFAULTS.tableSelector;

    clearHighlights();

    if (!keyword) {
      clearActiveSearchSession();
      setStatus("Please enter a keyword.");
      return;
    }

    savePanelState({
      keyword,
      delayMs
    });
    saveActiveSearchSession({
      keyword,
      delayMs
    });

    startBtn.disabled = true;
    stopBtn.disabled = false;
    cancelSearch = false;
    if (isAutoResume) setStatus("Resumed search on this page...");

    try {
      await searchAllPages({
        keyword,
        nextSelector: effectiveNextSelector,
        rowSelector: effectiveRowSelector,
        delayMs,
        maxPages: DEFAULTS.maxPages
      });
    } finally {
      isSearching = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  function maybeResumeActiveSearch(panel, launcher) {
    const session = getActiveSearchSession();
    if (!session) return;
    if (!session.keyword || !String(session.keyword).trim()) {
      clearActiveSearchSession();
      return;
    }
    const launch = launcher || document.getElementById(LAUNCHER_ID);
    if (panel && launch) showSearchPanel(panel, launch);
    setTimeout(() => {
      if (!isSearching) startSearchFromPanel(panel, true);
    }, 200);
  }

  function restorePanelState(panel) {
    const state = getSavedPanelState();
    if (!state) return;

    const keywordInput = panel.querySelector("#gts-keyword");
    const delayInput = panel.querySelector("#gts-delay");

    if (keywordInput && typeof state.keyword === "string") keywordInput.value = state.keyword;
    if (delayInput && Number.isFinite(Number(state.delayMs)) && Number(state.delayMs) > 0) {
      delayInput.value = String(Number(state.delayMs));
    }
  }

  function wirePanelPersistence(panel) {
    const syncState = () => {
      const keyword = panel.querySelector("#gts-keyword")?.value ?? "";
      const delayMs = Number(panel.querySelector("#gts-delay")?.value) || DEFAULTS.delayMs;

      savePanelState({
        keyword,
        delayMs
      });
    };

    panel.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", syncState);
      input.addEventListener("change", syncState);
    });
  }

  function getSavedPanelState() {
    try {
      const raw = localStorage.getItem(PANEL_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function savePanelState(state) {
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(state));
    } catch (_err) {
      // Ignore storage issues (private mode, quota, etc.).
    }
  }

  function getActiveSearchSession() {
    try {
      const raw = localStorage.getItem(SEARCH_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function saveActiveSearchSession(state) {
    try {
      localStorage.setItem(SEARCH_SESSION_KEY, JSON.stringify(state));
    } catch (_err) {
      // Ignore storage issues (private mode, quota, etc.).
    }
  }

  function clearActiveSearchSession() {
    try {
      localStorage.removeItem(SEARCH_SESSION_KEY);
    } catch (_err) {
      // Ignore storage issues (private mode, quota, etc.).
    }
  }

  function ensurePanelInjected() {
    if (document.getElementById(SEARCH_UI_ID) && document.getElementById(LAUNCHER_ID)) return;
    injectPanel();
  }

  async function searchAllPages({ keyword, nextSelector, rowSelector, delayMs, maxPages }) {
    if (isSearching) return;
    isSearching = true;
    const needle = keyword.toLowerCase();

    let currentPage = 1;
    let foundOnPage = 0;

    setStatus(`Searching page ${currentPage}...`);

    while (currentPage <= maxPages && !cancelSearch) {
      const rows = Array.from(document.querySelectorAll(rowSelector));
      foundOnPage = highlightMatchingRows(rows, needle);

      if (foundOnPage > 0) {
        setStatus(`Found ${foundOnPage} match(es) on page ${currentPage}.`);
        clearActiveSearchSession();
        alert(`Found "${keyword}" on page ${currentPage}.`);
        return;
      }

      const nextButton = getClickableNext(nextSelector);
      if (!nextButton) {
        setStatus(`No more pages. "${keyword}" not found.`);
        clearActiveSearchSession();
        alert(`Finished. "${keyword}" not found in scanned pages.`);
        return;
      }

      const previousSnapshot = getRowsSnapshot(rows);
      setStatus(`No match on page ${currentPage}. Moving next...`);
      nextButton.click();

      await waitForPageChange(rowSelector, previousSnapshot, delayMs);

      currentPage += 1;
      setStatus(`Searching page ${currentPage}...`);
    }

    if (cancelSearch) {
      setStatus("Search stopped by user.");
      clearActiveSearchSession();
      return;
    }

    clearActiveSearchSession();
    setStatus(`Reached safety limit (${maxPages} pages).`);
  }

  function getClickableNext(selector) {
    const fallbackSelectors = [
      'a[rel="next"]',
      "li.next a",
      ".pagination .next a",
      'a[aria-label*="Next"]',
      "button.next",
      "a.next"
    ];
    const currentUrl = normalizeUrl(window.location.href);
    const selectors = [selector, ...fallbackSelectors]
      .filter(Boolean)
      .map((s) => s.trim())
      .filter(Boolean);

    const seen = new Set();
    const candidates = [];
    for (const sel of selectors) {
      let nodes = [];
      try {
        nodes = Array.from(document.querySelectorAll(sel));
      } catch (_err) {
        continue;
      }
      for (const node of nodes) {
        if (!(node instanceof Element)) continue;
        if (seen.has(node)) continue;
        seen.add(node);
        candidates.push(node);
      }
    }

    // Extra generic fallback: any visible anchor/button with "next" text.
    if (!candidates.length) {
      const textMatches = Array.from(document.querySelectorAll("a, button")).filter((el) =>
        /\bnext\b/i.test(normalizeText(el.textContent))
      );
      candidates.push(...textMatches);
    }

    const scored = candidates
      .filter((el) => isElementVisible(el) && !isElementDisabled(el))
      .map((el) => ({ el, score: scoreNextCandidate(el, currentUrl) }))
      .filter((entry) => entry.score > -100);

    if (!scored.length) return null;
    scored.sort((a, b) => b.score - a.score);
    return scored[0].el;
  }

  function scoreNextCandidate(el, currentUrl) {
    let score = 0;
    const text = normalizeText(el.textContent).toLowerCase();
    const rel = (el.getAttribute("rel") || "").toLowerCase();
    const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
    const className = (el.className || "").toString().toLowerCase();

    if (rel.includes("next")) score += 100;
    if (className.includes("next")) score += 40;
    if (ariaLabel.includes("next")) score += 40;
    if (/\bnext\b/.test(text)) score += 30;
    if (text.includes("›") || text.includes(">")) score += 10;

    if (el.tagName === "A") {
      const href = el.getAttribute("href");
      if (!href || href === "#") return -100;
      const targetUrl = normalizeUrl(new URL(href, window.location.href).toString());
      if (targetUrl !== currentUrl) score += 30;
      else score -= 200;
    }

    if (el.closest(".disabled, .is-disabled")) score -= 200;
    return score;
  }

  function isElementDisabled(candidate) {
    if (!(candidate instanceof Element)) return true;
    const ariaDisabled = candidate.getAttribute("aria-disabled") === "true";
    const classDisabled =
      candidate.classList.contains("disabled") ||
      candidate.classList.contains("is-disabled");
    const htmlDisabled =
      candidate.hasAttribute("disabled") ||
      candidate.getAttribute("disabled") !== null;
    return ariaDisabled || classDisabled || htmlDisabled;
  }

  function isElementVisible(el) {
    if (!(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function normalizeUrl(urlValue) {
    try {
      const u = new URL(urlValue, window.location.href);
      return `${u.origin}${u.pathname}${u.search}`;
    } catch (_err) {
      return String(urlValue || "");
    }
  }

  function getRowsSnapshot(rows) {
    return rows.map((r) => normalizeText(r.innerText)).join("||");
  }

  async function waitForPageChange(rowSelector, oldSnapshot, fallbackDelayMs) {
    const timeoutMs = Math.max(2500, fallbackDelayMs + 1500);
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (cancelSearch) return;
      await sleep(150);

      const rows = Array.from(document.querySelectorAll(rowSelector));
      const newSnapshot = getRowsSnapshot(rows);
      if (newSnapshot && newSnapshot !== oldSnapshot) return;
    }

    await sleep(fallbackDelayMs);
  }

  function highlightMatchingRows(rows, needle) {
    let count = 0;
    for (const row of rows) {
      const text = normalizeText(row.innerText).toLowerCase();
      if (text.includes(needle)) {
        row.classList.add(HIGHLIGHT_CLASS);
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        count += 1;
      } else {
        row.classList.remove(HIGHLIGHT_CLASS);
      }
    }
    return count;
  }

  function clearHighlights() {
    const highlighted = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    highlighted.forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function setStatus(message) {
    const status = document.getElementById("gts-status");
    if (status) status.textContent = message;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
