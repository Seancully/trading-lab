// Simple global toast bus.
const listeners = new Set();
let nextId = 1;

export const toast = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  show(message, kind = 'info', ms = 2200) {
    const id = nextId++;
    const t = { id, message, kind };
    listeners.forEach(fn => fn({ type: 'add', toast: t }));
    setTimeout(() => listeners.forEach(fn => fn({ type: 'remove', id })), ms);
  },
  success(m, ms) { this.show(m, 'success', ms); },
  error(m, ms)   { this.show(m, 'error', ms); },
  info(m, ms)    { this.show(m, 'info', ms); },
};
