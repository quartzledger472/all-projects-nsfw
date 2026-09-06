const STORAGE_KEY = "siteConfig";

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return null;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getConfig() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || {};
}

async function setConfig(config) {
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

let host = null;

async function render() {
  const tab = await getActiveTab();
  host = tab ? hostFromUrl(tab.url) : null;

  const hostLabel = document.getElementById("host");
  const body = document.getElementById("body");

  if (!host) {
    hostLabel.textContent = "Not a regular web page";
    body.hidden = true;
    return;
  }

  hostLabel.textContent = host;
  body.hidden = false;

  const config = await getConfig();
  const site = config[host] || { enabled: true, rules: [] };

  document.getElementById("enabled").checked = site.enabled !== false;

  const list = document.getElementById("rules");
  list.innerHTML = "";
  (site.rules || []).forEach((rule) => {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = `${rule.type === "text" ? "Text: " : "Selector: "}${rule.value}`;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.className = "remove";
    removeBtn.addEventListener("click", async () => {
      const cfg = await getConfig();
      const s = cfg[host];
      if (!s) return;
      s.rules = (s.rules || []).filter((r) => r.id !== rule.id);
      await setConfig(cfg);
      render();
    });

    li.appendChild(label);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

document.getElementById("enabled").addEventListener("change", async (e) => {
  const config = await getConfig();
  config[host] = config[host] || { enabled: true, rules: [] };
  config[host].enabled = e.target.checked;
  await setConfig(config);
});

document.getElementById("addText").addEventListener("click", async () => {
  const input = document.getElementById("textInput");
  const value = input.value.trim();
  if (!value) return;
  const config = await getConfig();
  config[host] = config[host] || { enabled: true, rules: [] };
  config[host].rules.push({ id: `text-${Date.now()}`, type: "text", value });
  await setConfig(config);
  input.value = "";
  render();
});

document.getElementById("pick").addEventListener("click", async () => {
  const tab = await getActiveTab();
  await chrome.tabs.sendMessage(tab.id, { type: "start-picker" });
  window.close();
});

render();
