const output = document.getElementById("output");
const status = document.getElementById("status");
const dedupeCheckbox = document.getElementById("dedupe");

function collectLinksFromPage() {
  return Array.from(document.querySelectorAll("a[href]"))
    .map((a) => a.href)
    .filter((href) => href.startsWith("http://") || href.startsWith("https://"));
}

document.getElementById("collect").addEventListener("click", async () => {
  status.textContent = "Collecting...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: links }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectLinksFromPage,
    });

    const finalLinks = dedupeCheckbox.checked ? [...new Set(links)] : links;
    output.value = finalLinks.join("\n");
    status.textContent = `Found ${finalLinks.length} link${finalLinks.length === 1 ? "" : "s"}.`;
  } catch (err) {
    status.textContent = "Could not collect links on this page.";
  }
});

document.getElementById("copy").addEventListener("click", async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
    status.textContent = "Copied to clipboard!";
  } catch (err) {
    output.select();
    document.execCommand("copy");
    status.textContent = "Copied to clipboard!";
  }
});
