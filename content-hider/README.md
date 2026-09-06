# Section Hider

A browser extension that hides specific tabs/sections on a page. Comes
preconfigured to hide the "Big points" tab on namethatporn.com, and lets you
add more rules for any other site.

## How it works

- **Text rule**: hides any small element whose visible text matches a phrase
  exactly (case-insensitive), e.g. `Big points`. If that element looks like a
  tab (`<a>`, `<button>`, `role="tab"`, etc.) it hides the whole tab, and its
  associated panel too if it's wired up with `aria-controls`.
- **Picker**: click "Pick element to hide" in the popup, then click anything
  on the page — it hides instantly and saves a CSS selector so it stays
  hidden on future visits.

Rules are per-site and stored locally (`chrome.storage.local`) — nothing is
sent anywhere.

## Install in Opera

Opera uses the same extension format as Chrome, so you load it unpacked:

1. Open `opera://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select this `content-hider` folder.
5. Pin the extension, visit namethatporn.com, and the "Big points" tab
   should already be hidden. Click the extension icon to manage rules or
   turn it off for a site.

## Notes

- If the "Big points" text rule doesn't match cleanly on the live page
  (site markup can change), use "Pick element to hide" instead — click
  directly on the tab and it'll be hidden and remembered from then on.
- Remove the default rule for a site any time from the popup's rule list.
