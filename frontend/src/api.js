import { tr, getLocale } from "./i18n.js";
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
let refreshPending = null;
const ACCESS_KEY = 'smart-city-access';
const REFRESH_KEY = 'smart-city-refresh';

export const session = {
  get access() {return localStorage.getItem(ACCESS_KEY);},
  get refresh() {return localStorage.getItem(REFRESH_KEY);},
  save(tokens) {
    localStorage.setItem(ACCESS_KEY, tokens.access);
    localStorage.setItem(REFRESH_KEY, tokens.refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
};

async function read(response) {
  const text = await response.text();
  let data = null;
  try {data = text ? JSON.parse(text) : null;} catch {data = null;}
  if (!response.ok) {
    const message = data?.detail || Object.values(data || {}).flat().join(' · ') || tr("Ошибка запроса");
    const error = new Error(message);
    error.status = response.status;
    error.fields = data && typeof data === 'object' ? data : {};
    throw error;
  }
  return data;
}

export async function login(username, password) {
  const tokens = await authRequest('/account/login/', username, password);
  session.save(tokens);
  return tokens;
}

export async function register(username, password) {
  return authRequest('/account/register/', username, password);
}

async function authRequest(path, username, password) {
  let response;
  try {
    response = await fetch(BASE_URL + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  } catch {
    throw new Error(tr("Unable to connect to server"));
  }
  if (response.status >= 500) throw new Error(tr("Unable to connect to server. Please try again."));
  return read(response);
}

async function requestFreshAccess() {
  if (!session.refresh) throw new Error(tr("Войдите снова"));
  const response = await fetch(BASE_URL + '/account/token/refresh/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: session.refresh })
  });
  const tokens = await read(response);
  session.save({ access: tokens.access, refresh: tokens.refresh || session.refresh });
}

export function refreshAccess() {
  if (!refreshPending) refreshPending = requestFreshAccess().finally(() => {refreshPending = null;});
  return refreshPending;
}

/** @param {string} path @param {{method?: string, body?: unknown}} [options] */
export async function api(path, { method = 'GET', body } = {}) {
  const options = () => ({
    method,
    headers: {
      Authorization: `Bearer ${session.access}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let response = await fetch(BASE_URL + path, options());
  if (response.status === 401 && session.refresh) {
    try {
      await refreshAccess();
      response = await fetch(BASE_URL + path, options());
    } catch (error) {
      session.clear();
      throw error;
    }
  }
  if (response.status === 401) session.clear();
  return read(response);
}
