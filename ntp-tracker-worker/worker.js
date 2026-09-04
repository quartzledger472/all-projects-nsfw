// NTP Tracker worker — fetches NameThatPorn.com data server-side (avoids
// the browser CORS block a static frontend would hit) and returns it as
// JSON.
//
// Routes:
//   GET /activity?username=<name>&page=<n>   -> { username, page, count, activity: [...] }
//   GET /comments?username=<name>&page=<n>   -> { username, page, lastPage, count, comments: [...] }
//
// Deploy: see README.md in this folder.

const NTP_ORIGIN = 'https://namethatporn.com';
const USERNAME_RE = /^[a-zA-Z0-9_.-]{1,40}$/;

// A worker's outbound fetch() previously used a bare, clearly-non-browser
// User-Agent. namethatporn.com is itself behind Cloudflare, and requests
// were coming back 401 — closer-to-browser headers on both the page fetch
// and the AJAX fetch (with a matching Referer) to see if that's enough to
// get past whatever's distinguishing this from a real browser request.
const PAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: `${NTP_ORIGIN}/`,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// Icon class -> activity type, confirmed against a live profile fetch:
//   fa-comment                        -> comment
//   fa-check-square-o                 -> correct-answer
//   fa-star                           -> level-up
//   fa-thumbs-o-down fa-flip-horizontal -> helpful-confirm (e.g. "Confirmed incorrect answer")
// "helpful-vote" (plain fa-thumbs-o-up, presumably for upvoting a comment)
// hasn't been observed yet — falls through to the keyword match below.
function classifyIcon(cls) {
  const c = (cls || '').toLowerCase();
  if (c.includes('fa-comment')) return 'comment';
  if (c.includes('fa-check-square')) return 'correct-answer';
  if (c.includes('fa-star')) return 'level-up';
  if (c.includes('fa-thumbs-o-down')) return 'helpful-confirm';
  if (c.includes('fa-thumbs-o-up')) return 'helpful-vote';
  if (c.includes('comment')) return 'comment';
  if (c.includes('check') || c.includes('correct')) return 'correct-answer';
  if (c.includes('level') || c.includes('trophy')) return 'level-up';
  if (c.includes('confirm')) return 'helpful-confirm';
  if (c.includes('thumb') || c.includes('vote')) return 'helpful-vote';
  return 'other';
}

// ---- Activity feed parsing (plain profile page HTML) ----
// HTMLRewriter processes matched elements in document order and doesn't
// nest same-selector matches here, so a single shared "current item"
// reference is safe to mutate across handlers.
class ActivityItemStart {
  constructor(state) {
    this.state = state;
  }
  element() {
    const item = { type: 'other', iconClass: '', text: '', ago: '' };
    this.state.items.push(item);
    this.state.current = item;
  }
}

class IconClassCapture {
  constructor(state) {
    this.state = state;
  }
  element(el) {
    if (!this.state.current) return;
    const cls = el.getAttribute('class') || '';
    this.state.current.iconClass = cls;
    this.state.current.type = classifyIcon(cls);
  }
}

// Text-collector pattern: element() resets the buffer, text() appends each
// chunk (HTMLRewriter can split a text node into multiple calls, and text
// inside child tags like a bold "+N" still flows through here), onEndTag()
// finalizes the buffer into the current item's field.
class TextAccumulator {
  constructor(state, field) {
    this.state = state;
    this.field = field;
    this.buffer = '';
  }
  element(el) {
    this.buffer = '';
    const item = this.state.current;
    el.onEndTag(() => {
      if (item) item[this.field] = this.buffer.replace(/\s+/g, ' ').trim();
      this.buffer = '';
    });
  }
  text(chunk) {
    this.buffer += chunk.text;
  }
}

async function handleActivity(username, page) {
  const target = `${NTP_ORIGIN}/user/${encodeURIComponent(username)}.html${page > 1 ? `?page=${page}` : ''}`;

  const upstream = await fetch(target, { headers: PAGE_HEADERS });

  if (upstream.status === 404) {
    return jsonResponse({ error: 'user_not_found', username }, 404);
  }
  if (!upstream.ok) {
    return jsonResponse({ error: 'upstream_error', status: upstream.status }, 502);
  }

  const state = { items: [], current: null };
  const rewriter = new HTMLRewriter()
    .on('#uxp_even_wrap li', new ActivityItemStart(state))
    .on('#uxp_even_wrap li .uxp_eve_icon i', new IconClassCapture(state))
    .on('#uxp_even_wrap li .uxp_eve_text', new TextAccumulator(state, 'text'))
    .on('#uxp_even_wrap li .uxp_eve_ago', new TextAccumulator(state, 'ago'));

  // Draining the body is what actually runs the handlers.
  await rewriter.transform(upstream).arrayBuffer();

  const activity = state.items
    .filter((it) => it.text)
    .map((it) => {
      // Activity text may start with a bold "+N" point delta, e.g. "+5 pts for a correct answer".
      const m = it.text.match(/^\+(\d+)\b\s*(.*)$/);
      return {
        type: it.type,
        iconClass: it.iconClass,
        pointsDelta: m ? Number(m[1]) : null,
        text: m ? m[2] : it.text,
        ago: it.ago,
      };
    });

  return jsonResponse({ username, page, count: activity.length, activity });
}

// ---- Comments tab parsing (ajax_profile.json) ----
// The "Comments" tab on a profile isn't in the plain page HTML — it's
// fetched client-side via GET /ajax_profile.json?a=uxpagnat&u=<userid>
// &un=<username>&ct=comments&cp=<page>, which returns
// { type: "OK", html: "<ul id=\"uxp_even_wrap\">...</ul>..." } where each
// <li>'s .uxp_eve_text is `<a href="/post/...">Post Title</a><br>Comment body`.
// That needs the numeric user id first, which only the plain profile page
// exposes (#ux_profile_wrapper[data-userid]).

class UserIdCapture {
  constructor(state) {
    this.state = state;
  }
  element(el) {
    const uid = el.getAttribute('data-userid');
    if (uid) this.state.userId = uid;
  }
}

// Temporary diagnostic: capture headers/body that hint at *why* an upstream
// request was rejected (Cloudflare's own block pages are usually
// self-identifying) instead of just the bare status code. Remove once the
// 401s are understood and resolved.
async function describeUpstreamError(res) {
  const headerNames = ['cf-mitigated', 'cf-ray', 'server', 'content-type', 'www-authenticate'];
  const headers = {};
  for (const name of headerNames) {
    const v = res.headers.get(name);
    if (v) headers[name] = v;
  }
  let bodySnippet = '';
  try {
    bodySnippet = (await res.text()).slice(0, 300);
  } catch (err) {
    bodySnippet = '(could not read body)';
  }
  return { status: res.status, headers, bodySnippet };
}

async function fetchUserId(username) {
  const target = `${NTP_ORIGIN}/user/${encodeURIComponent(username)}.html`;
  const upstream = await fetch(target, { headers: PAGE_HEADERS });

  if (upstream.status === 404) return { error: 'user_not_found' };
  if (!upstream.ok) return { error: 'upstream_error', debug: await describeUpstreamError(upstream) };

  const state = { userId: null };
  await new HTMLRewriter()
    .on('#ux_profile_wrapper', new UserIdCapture(state))
    .transform(upstream)
    .arrayBuffer();

  if (!state.userId) return { error: 'parse_failed' };
  return { userId: state.userId };
}

class CommentItemStart {
  constructor(state) {
    this.state = state;
  }
  element() {
    const item = { postTitle: '', postHref: '', text: '', ago: '' };
    this.state.items.push(item);
    this.state.current = item;
    this.state.buffer = '';
  }
}

// The post title's <a> and the comment body that follows a <br> both live
// inside the same .uxp_eve_text block with no separating whitespace in the
// source, so a <br>-triggered handler inserts a "\n" into the shared
// buffer to mark where the title ends and the comment body begins.
class BrSeparator {
  constructor(state) {
    this.state = state;
  }
  element() {
    this.state.buffer += '\n';
  }
}

class PostLinkCapture {
  constructor(state) {
    this.state = state;
    this.buffer = '';
  }
  element(el) {
    if (this.state.current) this.state.current.postHref = el.getAttribute('href') || '';
    this.buffer = '';
    const item = this.state.current;
    el.onEndTag(() => {
      if (item) item.postTitle = this.buffer.replace(/\s+/g, ' ').trim();
      this.buffer = '';
    });
  }
  text(chunk) {
    this.buffer += chunk.text;
  }
}

class CommentTextAccumulator {
  constructor(state) {
    this.state = state;
  }
  element(el) {
    this.state.buffer = '';
    const item = this.state.current;
    el.onEndTag(() => {
      if (item) {
        // buffer holds "<post title text>\n<comment body text>" — the title
        // half is redundant with PostLinkCapture's result, so drop it.
        const parts = this.state.buffer.split('\n');
        item.text = parts.slice(1).join(' ').replace(/\s+/g, ' ').trim();
      }
      this.state.buffer = '';
    });
  }
  text(chunk) {
    this.state.buffer += chunk.text;
  }
}

class AgoAccumulator {
  constructor(state) {
    this.state = state;
    this.buffer = '';
  }
  element(el) {
    this.buffer = '';
    const item = this.state.current;
    el.onEndTag(() => {
      if (item) item.ago = this.buffer.replace(/\s+/g, ' ').trim();
      this.buffer = '';
    });
  }
  text(chunk) {
    this.buffer += chunk.text;
  }
}

class LastPageCapture {
  constructor(state) {
    this.state = state;
  }
  element(el) {
    const p = el.getAttribute('data-page');
    if (p) this.state.lastPage = parseInt(p, 10) || null;
  }
}

async function handleComments(username, page) {
  const idResult = await fetchUserId(username);
  if (idResult.error === 'user_not_found') {
    return jsonResponse({ error: 'user_not_found', username }, 404);
  }
  if (idResult.error) {
    return jsonResponse({ error: idResult.error, debug: idResult.debug }, 502);
  }

  const ajaxUrl =
    `${NTP_ORIGIN}/ajax_profile.json?ts=${(Date.now() / 1000).toFixed(2)}` +
    `&a=uxpagnat&u=${encodeURIComponent(idResult.userId)}&un=${encodeURIComponent(username)}` +
    `&ct=comments&cp=${page}`;

  // Headers matching what an XHR fired from the profile page itself would
  // send — Referer pointing at that page, and the X-Requested-With marker
  // jQuery/most frontends set automatically on AJAX calls.
  const ajaxHeaders = {
    ...PAGE_HEADERS,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Referer: `${NTP_ORIGIN}/user/${encodeURIComponent(username)}.html`,
    'X-Requested-With': 'XMLHttpRequest',
  };

  const ajaxRes = await fetch(ajaxUrl, { headers: ajaxHeaders });
  if (!ajaxRes.ok) {
    return jsonResponse({ error: 'upstream_error', debug: await describeUpstreamError(ajaxRes) }, 502);
  }

  const data = await ajaxRes.json();
  if (data.type !== 'OK' || typeof data.html !== 'string') {
    return jsonResponse({ error: 'unexpected_response' }, 502);
  }

  const state = { items: [], current: null, buffer: '', lastPage: null };
  const rewriter = new HTMLRewriter()
    .on('#uxp_even_wrap li', new CommentItemStart(state))
    .on('#uxp_even_wrap li .uxp_eve_text a', new PostLinkCapture(state))
    .on('#uxp_even_wrap li .uxp_eve_text br', new BrSeparator(state))
    .on('#uxp_even_wrap li .uxp_eve_text', new CommentTextAccumulator(state))
    .on('#uxp_even_wrap li .uxp_eve_ago', new AgoAccumulator(state))
    .on('#ux_lastpage', new LastPageCapture(state));

  await rewriter.transform(new Response(data.html, { headers: { 'Content-Type': 'text/html' } })).arrayBuffer();

  const comments = state.items
    .filter((it) => it.postTitle || it.text)
    .map((it) => ({
      postTitle: it.postTitle,
      postHref: it.postHref ? `${NTP_ORIGIN}${it.postHref}` : '',
      text: it.text,
      ago: it.ago,
    }));

  return jsonResponse({ username, page, lastPage: state.lastPage, count: comments.length, comments });
}

// Temporary diagnostic route: fetch an arbitrary same-site path with the
// same headers /comments and /activity use, and report back exactly what
// came back — lets us compare namethatporn.com's response across several
// paths (homepage, a public page, the profile page) without a redeploy
// per hypothesis. `path` is only ever appended to NTP_ORIGIN, never used
// to build a different host. Remove once the 401 investigation is done.
async function handleDebug(path) {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const target = `${NTP_ORIGIN}${safePath}`;
  const upstream = await fetch(target, { headers: PAGE_HEADERS });
  const info = await describeUpstreamError(upstream);
  return jsonResponse({ path: safePath, target, ok: upstream.ok, ...info });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/debug') {
      const path = url.searchParams.get('path') || '/';
      try {
        return await handleDebug(path);
      } catch (err) {
        return jsonResponse({ error: 'fetch_failed', message: String(err) }, 502);
      }
    }

    const username = (url.searchParams.get('username') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);

    if (url.pathname === '/activity' || url.pathname === '/comments') {
      if (!username) return jsonResponse({ error: 'missing_username' }, 400);
      if (!USERNAME_RE.test(username)) return jsonResponse({ error: 'invalid_username' }, 400);

      try {
        return url.pathname === '/comments'
          ? await handleComments(username, page)
          : await handleActivity(username, page);
      } catch (err) {
        return jsonResponse({ error: 'fetch_failed', message: String(err) }, 502);
      }
    }

    return jsonResponse(
      {
        error: 'not_found',
        hint:
          'GET /comments?username=<name>[&page=<n>]  or  GET /activity?username=<name>[&page=<n>]  or  GET /debug?path=<path-on-namethatporn.com>',
      },
      404
    );
  },
};
