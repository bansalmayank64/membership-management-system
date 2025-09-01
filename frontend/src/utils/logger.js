// Lightweight frontend logger. Exports a logger and attaches it to window.logger
// so existing code that references `logger.debug(...)` without imports will work.

const createConsoleLogger = () => {
  const shouldUseConsole = typeof console !== 'undefined';
  const wrap = (fnName) => (...args) => {
    if (!shouldUseConsole) return;
    try {
      // Use the console method if available, otherwise fallback to console.log
      const fn = console[fnName] || console.log;
      fn.apply(console, args);
    } catch (e) {
      // swallow any console errors to avoid breaking the app
    }
  };

  return {
    debug: wrap('debug'),
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error'),
    // no-op level for production if needed
    silent: () => {},
  };
};

const logger = createConsoleLogger();

// Attach to window for modules that reference global `logger` without importing.
try {
  if (typeof window !== 'undefined' && !window.logger) {
    window.logger = logger;
  }
} catch (e) {
  // ignore in non-browser environments
}

export default logger;
