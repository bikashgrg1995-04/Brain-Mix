/** Chhoto sandesh (badge unlock, inam). Screen reader le pani padhchha (role=status). */
export function toast(html: string, ms = 3200): void {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  host.appendChild(t);
  window.setTimeout(() => t.remove(), ms);
}
