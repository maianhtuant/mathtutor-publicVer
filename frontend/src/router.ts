import { useEffect, useState } from 'react';

/** Minimal hash router: "#/attempts/123" -> path "/attempts/123". Works with any static host. */
export function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
}

export function navigate(path: string) {
  if (currentPath() !== path) window.location.hash = path;
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

/** match('/attempts/:id', '/attempts/42') -> { id: '42' } */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('?')[0].split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

const RETURN_KEY = 'mathtutor.returnTo';

/** Remember where a logged-out visitor was going, so login can send them back there. */
export function rememberReturnPath(path: string) {
  try { sessionStorage.setItem(RETURN_KEY, path); } catch { /* storage unavailable */ }
}

/** Path to open after login/registration (the remembered page, or home). */
export function takeReturnPath(): string {
  try {
    const p = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return p && p.startsWith('/') && p !== '/login' && p !== '/register' ? p : '/';
  } catch {
    return '/';
  }
}

/** Read "?key=value" from the hash route, e.g. "#/videos?subject=123". */
export function queryParam(name: string): string | null {
  const q = currentPath().split('?')[1];
  return q ? new URLSearchParams(q).get(name) : null;
}
