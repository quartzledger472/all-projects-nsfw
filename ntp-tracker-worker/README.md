# ntp-tracker-worker

Cloudflare Worker that fetches NameThatPorn.com data server-side and
returns it as CORS-enabled JSON. Exists so the static `ntp-tracker/index.html`
frontend can read it — NameThatPorn serves plain HTML with no CORS headers,
so a browser can't `fetch()` it directly from another origin.

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

Copy that URL into `ntp-tracker/index.html`'s `WORKER_URL` constant near
the top of the `<script>` block.

## API

### `GET /comments?username=<name>&page=<n>`

The profile's Comments tab (confirmed against a live fetch — the profile
page's tabs are client-side, loaded via an internal AJAX endpoint, not
present in the static page HTML). `page` defaults to `1`.

```json
{
  "username": "redcollar1275",
  "page": 1,
  "lastPage": 14,
  "count": 20,
  "comments": [
    {
      "postTitle": "Confirm thread",
      "postHref": "https://namethatporn.com/post/876624-confirm-thread.html#2528816",
      "text": "Thanks in advance!",
      "ago": "1 hour ago"
    }
  ]
}
```

How it works: NameThatPorn's own frontend fetches
`GET /ajax_profile.json?ts=<unix-time>&a=uxpagnat&u=<userid>&un=<username>&ct=comments&cp=<page>`,
which returns `{ "type": "OK", "html": "<ul id=\"uxp_even_wrap\">...</ul>..." }`
— an HTML fragment, not the profile's numeric user id (`u`) up front, so
`handleComments()` first fetches the plain profile page
(`/user/<username>.html`) to read `data-userid` off
`#ux_profile_wrapper`, then calls the AJAX endpoint. `lastPage` comes from
`#ux_lastpage`'s `data-page` attribute in that fragment.

### `GET /activity?username=<name>&page=<n>`

The profile's default Activity tab, which unlike Comments *is* present in
the plain page HTML (`#uxp_even_wrap` inside `#uxp_maintab`), so this one
scrapes the static page directly rather than calling the AJAX endpoint.
Mixes correct answers, comments, level-ups, and confirms/votes into one
feed:

```json
{
  "username": "redcollar1275",
  "page": 1,
  "count": 20,
  "activity": [
    {
      "type": "correct-answer",
      "iconClass": "fa fa-fw fa-check-square-o",
      "pointsDelta": 25,
      "text": "Correct answer in Who is she or can you find me the video???",
      "ago": "5 hours ago"
    }
  ]
}
```

`type` is one of `correct-answer`, `comment`, `level-up`,
`helpful-confirm`, `helpful-vote` (untested — no example seen yet), or
`other` (unrecognized icon class — `iconClass` is included so it can be
tuned in `classifyIcon()`). The icon-class mapping for the first four was
confirmed against a live fetch:

| icon class | type |
|---|---|
| `fa-comment` | `comment` |
| `fa-check-square-o` | `correct-answer` |
| `fa-star` | `level-up` |
| `fa-thumbs-o-down fa-flip-horizontal` | `helpful-confirm` |

## Known gaps / next steps

- **`page > 1` on `/activity` is unverified.** It appends `?page=N` to the
  static profile URL, which was never confirmed against a real paginated
  request. `/comments`' pagination (`cp=N` on the AJAX endpoint) *is*
  confirmed — a `?page=2` request there uses the same `cp` param the site
  itself uses.
- **`helpful-vote` type is unconfirmed** — no example with that icon class
  was seen in the one profile fetched so far.
- **`#uxp_stats` (level, points, accuracy, etc.) isn't parsed yet.** Out of
  scope for this pass. Adding it is a matter of another `HTMLRewriter`
  selector block over `#uxp_stats li` on the plain profile page HTML,
  following the same text-collector pattern used elsewhere in this file.
- **No caching.** Every request re-fetches NameThatPorn, and `/comments`
  makes two upstream requests per call (profile page for the user id, then
  the AJAX endpoint). Fine for casual use; add a `Cache-Control` header or
  KV cache (e.g. cache username → userid) if this gets hit hard.
- **CORS is wide open** (`Access-Control-Allow-Origin: *`). Fine for a
  public read-only endpoint with no auth; tighten to the frontend's exact
  origin if that ever matters.
