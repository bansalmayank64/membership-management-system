// Small runtime console filter to reduce noisy logs in production builds.
// - Disables .log and .debug by default in production.
// - Keeps .warn and .error but sanitizes large objects and masks sensitive keys.
// - Honor localStorage.debugLogs = 'true' to re-enable logs for debugging.

const SENSITIVE_KEY_RE = /password|pass|pwd|token|secret|authorization|auth|ssn/i;
const MAX_STRING_LENGTH = 300;
const MAX_ITEMS = 20;

function maskSensitive(key, value) {
  if (typeof key === 'string' && SENSITIVE_KEY_RE.test(key)) return '***MASKED***';
  if (typeof value === 'string' && SENSITIVE_KEY_RE.test(value)) return '***MASKED***';
  return value;
}

function sanitizeValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 3) return '[Max depth]';

  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) return value.slice(0, MAX_STRING_LENGTH) + '...';
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    if (value.length > MAX_ITEMS) return `[Array length=${value.length}]`;
    return value.map((v) => sanitizeValue(v, depth + 1));
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > MAX_ITEMS) return `[Object keys=${keys.length}]`;
    const out = {};
    for (const k of keys) {
      out[k] = maskSensitive(k, sanitizeValue(value[k], depth + 1));
    }
    return out;
  }

  return String(value);
}

export function setupConsoleFilter() {
  try {
    const isProd = typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.PROD
      ? true
      : (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');

    const allowOverride = typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('debugLogs') === 'true';
    const enabled = !isProd || allowOverride;

    // Keep originals
    const originals = {
      log: console.log.bind(console),
      debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    // No-op for disabled functions
    const noop = () => {};

    // Replace console methods
    console.log = enabled ? ((...args) => originals.log(...args.map(sanitizeValue))) : noop;
    console.debug = enabled ? ((...args) => originals.debug(...args.map(sanitizeValue))) : noop;

    // Keep warnings and errors in production but sanitize their args
    console.info = (...args) => originals.info(...args.map(sanitizeValue));
    console.warn = (...args) => originals.warn(...args.map(sanitizeValue));
    console.error = (...args) => originals.error(...args.map(sanitizeValue));

    // Provide a small helper to force-enable logs at runtime
    Object.defineProperty(window, '__enableDebugLogs', {
      value: () => {
        window.localStorage.setItem('debugLogs', 'true');
        window.location.reload();
      },
    });

  } catch (e) {
    // If anything fails here, don't break the app — fallback to originals.
    // eslint-disable-next-line no-console
    console.warn('consoleFilter setup failed:', e);
  }
}

export default setupConsoleFilter;
