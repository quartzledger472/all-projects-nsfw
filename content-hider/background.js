const STORAGE_KEY = "siteConfig";

// Ships with one starter rule so the extension does something useful
// out of the box; users can remove or add to it from the popup.
const DEFAULT_SITE_RULES = {
  "namethatporn.com": [
    { id: "default-big-points", type: "text", value: "Big points" }
  ]
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const config = data[STORAGE_KEY] || {};
  for (const [host, rules] of Object.entries(DEFAULT_SITE_RULES)) {
    if (!config[host]) {
      config[host] = { enabled: true, rules };
    }
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "picker-result") {
    chrome.storage.local.get(STORAGE_KEY).then((data) => {
      const config = data[STORAGE_KEY] || {};
      const site = config[msg.host] || { enabled: true, rules: [] };
      site.enabled = true;
      site.rules = site.rules || [];
      site.rules.push({
        id: `sel-${Date.now()}`,
        type: "selector",
        value: msg.selector
      });
      config[msg.host] = site;
      chrome.storage.local.set({ [STORAGE_KEY]: config });
    });
  }
});
