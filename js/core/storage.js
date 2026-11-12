const USERS_KEY = "baze-life-users-v3";
const SAVE_PREFIX = "baze-life-save-v3:";
const DIRECT_MESSAGES_KEY = "baze-life-direct-messages-v1";
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


// Private messages for local prototype accounts. These are shared only by
// accounts registered in this browser; online accounts use Supabase instead.
export function loadLocalDirectMessages(usernameA, usernameB) {
  try {
    const a = String(usernameA || "").toLowerCase();
    const b = String(usernameB || "").toLowerCase();
    return JSON.parse(localStorage.getItem(DIRECT_MESSAGES_KEY) || "[]")
      .filter(message => {
        const sender = String(message.sender_username || "").toLowerCase();
        const recipient = String(message.recipient_username || "").toLowerCase();
        return (sender === a && recipient === b) || (sender === b && recipient === a);
      })
      .sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
  } catch { return []; }
}

export function sendLocalDirectMessage(senderUsername, recipientUsername, body) {
  const clean = String(body || "").trim().slice(0, 500);
  if (!clean) return;
  const messages = (() => {
    try { return JSON.parse(localStorage.getItem(DIRECT_MESSAGES_KEY) || "[]"); }
    catch { return []; }
  })();
  messages.push({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender_username: String(senderUsername || ""),
    recipient_username: String(recipientUsername || ""),
    body: clean,
    created_at: new Date().toISOString()
  });
  // Keep the local prototype store bounded.
  localStorage.setItem(DIRECT_MESSAGES_KEY, JSON.stringify(messages.slice(-2000)));
}
