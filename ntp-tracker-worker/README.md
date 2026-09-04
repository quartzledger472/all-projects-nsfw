# ntp-tracker-worker

Cloudflare Worker that fetches a NameThatPorn.com user profile page
server-side and returns the activity feed as CORS-enabled JSON. Exists so
the static `ntp-tracker/index.html` frontend can read it — NameThatPorn
serves plain HTML with no CORS headers, so a browser can't `fetch()` it
directly from another origin.

This is **not** deployed as part of the repo's static hosting. It's a
separate Cloudflare Workers deploy on the free tier.

## Deploy

From this folder:

```sh
npx wrangler login      # opens a browser to authorize your Cloudflare account
npx wrangler deploy
```

Wrangler prints the deployed URL, something like:

```
https://ntp-tracker-worker.<your-subdomain>.workers.dev
```

Copy that URL into `ntp-tracker/index.html` — set the `WORKER_URL` constant
near the top of the `<script>` block to it.

## API

```
GET /activity?username=<name>&page=<n>
```

`page` defaults to `1`. Response:

```json
{
  "username": "redcollar1275",
  "page": 1,
  "count": 20,
  "activity": [
    {
      "type": "correct-answer",
      "iconClass": "fa fa-check",
      "pointsDelta": 5,
      "text": "pts for a correct answer",
      "ago": "2 hours ago"
    }
  ]
}
```

`type` is one of `correct-answer`, `comment`, `level-up`,
`helpful-confirm`, `helpful-vote`, or `other` (unrecognized icon class —
`iconClass` is included so it can be tuned in `worker.js`'s
`classifyIcon()`).

## Known gaps / next steps

- **Icon classification is a best-effort guess.** The exact icon font
  class names used by NameThatPorn weren't confirmed against a live
  fetch when this was written. After the first real deploy, hit
  `/activity?username=redcollar1275` and check whether any items come
  back as `type: "other"` — if so, look at their `iconClass` and add a
  keyword match in `classifyIcon()`.
- **Pagination URL is a guess.** `page > 1` requests append `?page=N` to
  the profile URL (`/user/<name>.html?page=N`). Verify this against a
  real paginated profile (the task notes ~70+ pages of history exist for
  active users) and adjust `handleActivity()` if NameThatPorn uses a
  different pattern (e.g. `/user/<name>/page/N.html`).
- **`#uxp_stats` (level, points, accuracy, etc.) isn't parsed yet.** The
  stats dashboard was scoped out of this pass in favor of shipping the
  activity/comments list first. Adding it is a matter of another
  `HTMLRewriter` selector block over `#uxp_stats li` following the same
  text-collector pattern used for the activity feed.
- **No caching.** Every request re-fetches NameThatPorn. Fine for casual
  use; add a `Cache-Control` header or KV cache if this gets hit hard.
- **CORS is wide open** (`Access-Control-Allow-Origin: *`). Fine for a
  public read-only endpoint with no auth; tighten to the frontend's exact
  origin if that ever matters.
