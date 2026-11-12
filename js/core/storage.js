const USERS_KEY = "baze-life-users-v3";
const SAVE_PREFIX = "baze-life-save-v3:";
export function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
}
export async function passwordHash(password) {
  if (globalThis.crypto?.subtle) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("BAZE-LIFE-v3:" + password));
    return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2,"0")).join("");
  }
  // Local prototype fallback only; use Live Server for Web Crypto password hashing.
  let h = 2166136261;
  for (const ch of password) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return "fallback-" + (h >>> 0).toString(16);
}
export function addUser(user) {
  const users = getUsers(); users.push(user); localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
export function findUser(username) { return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase()); }
export function savePlayer(state) { localStorage.setItem(SAVE_PREFIX + state.username.toLowerCase(), JSON.stringify(state)); }
export function loadPlayer(username) {
  try { const s = localStorage.getItem(SAVE_PREFIX + username.toLowerCase()); return s ? JSON.parse(s) : null; }
  catch { return null; }
}
