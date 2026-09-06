(() => {
  const STORAGE_KEY = "siteConfig";
  const HIDDEN_ATTR = "data-section-hider-hidden";

  function hostKey() {
    return location.hostname.replace(/^www\./, "");
  }

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function hide(el) {
    if (!el || el.hasAttribute(HIDDEN_ATTR)) return;
    el.setAttribute(HIDDEN_ATTR, "1");
    el.style.setProperty("display", "none", "important");
  }

  // Walk a few levels up from a text match to find the actual tab/nav
  // item, rather than hiding a bare <span> with no visible box around it.
  function findTabLikeAncestor(el) {
    const candidateSelector = 'li, a, button, [role="tab"], .tab, .nav-item, .menu-item';
    let node = el;
    for (let i = 0; i < 4 && node; i++) {
      if (node.matches && node.matches(candidateSelector)) return node;
      node = node.parentElement;
    }
    return el;
  }

  function applyTextRule(phrase) {
    const target = normalize(phrase);
    if (!target || !document.body) return;
    const all = document.body.querySelectorAll("*");
    for (const el of all) {
      if (el.hasAttribute(HIDDEN_ATTR)) continue;
      if (el.children.length > 3) continue;
      if (normalize(el.textContent) !== target) continue;
      const container = findTabLikeAncestor(el);
      hide(container);
      const controls = container.getAttribute && container.getAttribute("aria-controls");
      if (controls) {
        const panel = document.getElementById(controls);
        if (panel) hide(panel);
      }
    }
  }

  function applySelectorRule(selector) {
    if (!selector) return;
    let nodes;
    try {
      nodes = document.querySelectorAll(selector);
    } catch (e) {
      return;
    }
    nodes.forEach(hide);
  }

  function applyRules(rules) {
    if (!rules || !rules.length) return;
    for (const rule of rules) {
      if (rule.type === "text") applyTextRule(rule.value);
      else if (rule.type === "selector") applySelectorRule(rule.value);
    }
  }

  let currentRules = [];
  let enabled = false;

  function runPass() {
    if (!enabled) return;
    applyRules(currentRules);
  }

  function loadAndApply() {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const config = (data[STORAGE_KEY] || {})[hostKey()];
      enabled = config ? config.enabled !== false : false;
      currentRules = config ? config.rules || [] : [];
      runPass();
    });
  }

  loadAndApply();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) loadAndApply();
  });

  const observer = new MutationObserver(() => runPass());
  function start() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      runPass();
    } else {
      requestAnimationFrame(start);
    }
  }
  start();

  document.addEventListener("DOMContentLoaded", runPass);
  window.addEventListener("load", runPass);

  // ---- Picker mode: click "Pick element to hide" in the popup, then
  // click anything on the page to hide it and save a selector for it. ----
  let picking = false;
  let hoverEl = null;

  function cssPath(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let selector = node.tagName.toLowerCase();
      if (node.classList.length) {
        selector += "." + Array.from(node.classList).slice(0, 2).map((c) => CSS.escape(c)).join(".");
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) {
          selector += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      parts.unshift(selector);
      if (node.id) break;
      node = parent;
    }
    return parts.join(" > ");
  }

  function onMouseOver(e) {
    if (!picking) return;
    if (hoverEl) hoverEl.style.removeProperty("outline");
    hoverEl = e.target;
    hoverEl.style.setProperty("outline", "2px solid #ff3366", "important");
  }

  function onClick(e) {
    if (!picking) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    if (hoverEl) hoverEl.style.removeProperty("outline");
    const selector = cssPath(el);
    hide(el);
    stopPicking();
    chrome.runtime.sendMessage({ type: "picker-result", host: hostKey(), selector });
  }

  function onKeyDown(e) {
    if (e.key === "Escape") stopPicking();
  }

  function startPicking() {
    picking = true;
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function stopPicking() {
    picking = false;
    if (hoverEl) hoverEl.style.removeProperty("outline");
    hoverEl = null;
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "start-picker") {
      startPicking();
      sendResponse({ ok: true });
    }
  });
})();
