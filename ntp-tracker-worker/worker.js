// NTP Tracker worker — fetches a NameThatPorn.com user profile server-side
// (avoids the browser CORS block a static frontend would hit) and returns
// the activity feed as JSON.
//
// Routes:
//   GET /activity?username=<name>&page=<n>   -> { username, page, count, activity: [...] }
//
// Deploy: see README.md in this folder.

const NTP_ORIGIN = 'https://namethatporn.com';
const USERNAME_RE = /^[a-zA-Z0-9_.-]{1,40}$/;

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

// Icon class -> activity type. NameThatPorn encodes the activity type as an
// icon font class on `.uxp_eve_icon i`. The exact class names weren't
// confirmed against a live fetch, so this is a best-effort keyword match —
// `iconClass` is included in the response so it can be tuned after the
// first real deploy if a type comes back as "other".
function classifyIcon(cls) {
  const c = (cls || '').toLowerCase();
  if (c.includes('comment')) return 'comment';
  if (c.includes('check') || c.includes('correct')) return 'correct-answer';
  if (c.includes('level') || c.includes('star') || c.includes('trophy')) return 'level-up';
  if (c.includes('confirm')) return 'helpful-confirm';
  if (c.includes('thumb') || c.includes('vote') || c.includes('up')) return 'helpful-vote';
  return 'other';
}

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

  const upstream = await fetch(target, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ntp-tracker/1.0)' },
  });

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

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/activity') {
      const username = (url.searchParams.get('username') || '').trim();
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);

      if (!username) return jsonResponse({ error: 'missing_username' }, 400);
      if (!USERNAME_RE.test(username)) return jsonResponse({ error: 'invalid_username' }, 400);

      try {
        return await handleActivity(username, page);
      } catch (err) {
        return jsonResponse({ error: 'fetch_failed', message: String(err) }, 502);
      }
    }

    return jsonResponse(
      { error: 'not_found', hint: 'GET /activity?username=<name>[&page=<n>]' },
      404
    );
  },
};
