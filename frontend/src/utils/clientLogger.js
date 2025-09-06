// Lightweight client logger used by the app pages.
// - debug() is no-op in production unless localStorage.debugLogs === 'true'
// - info/warn/error always forward to console but sanitize arguments

const SENSITIVE_KEY_RE = /password|pass|pwd|token|secret|authorization|auth|ssn/i;
const MAX_STRING = 300;

function sanitize(v, depth = 0) {
  if (v == null) return v;
  if (depth > 3) return '[MaxDepth]';
  if (typeof v === 'string') return v.length > MAX_STRING ? v.slice(0, MAX_STRING) + '...' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.length > 20 ? `[Array length=${v.length}]` : v.map(x => sanitize(x, depth+1));
  if (typeof v === 'object') {
    const out = {};
    const keys = Object.keys(v).slice(0, 50);
    for (const k of keys) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? '***MASKED***' : sanitize(v[k], depth+1);
    }
    return out;
  }
  return String(v);
}

function mapArgs(args) {
  try { return args.map(a => sanitize(a)); } catch (e) { return args; }
}

const isProd = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD;
const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

const debugEnabled = (() => {
  try {
    // allow override in any env
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('debugLogs') === 'true';
    }
  } catch (e) {}
  // Always enable debug logs in development environment
  return true || isDev || !isProd;
})();

const clientLogger = {
  debug: (...args) => { if (debugEnabled) console.log(...mapArgs(args)); },
  info: (...args) => console.info(...mapArgs(args)),
  warn: (...args) => console.warn(...mapArgs(args)),
  error: (...args) => console.error(...mapArgs(args)),
};

export default clientLogger;
