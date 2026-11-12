import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

let client = null;
let communityChannel = null;
const configured = /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("YOUR_");

export async function initMultiplayer() {
  if (!configured) return { enabled: false, reason: "Supabase project keys have not been added." };
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return { enabled: true };
  } catch (error) {
    console.error("Supabase initialization failed", error);
    return { enabled: false, reason: "Could not load Supabase. Check your internet connection and project keys." };
  }
}

export function multiplayerEnabled() { return Boolean(client); }

export async function registerOnlineStudent({ email, password, name, username, gender }) {
  if (!client) throw new Error("Online multiplayer is not configured yet.");
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(name || "").trim();
  const cleanUsername = String(username || "").trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Enter a valid email address.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters for Supabase accounts.");
  if (!/^[A-Za-z0-9_]{3,18}$/.test(cleanUsername)) throw new Error("Username must be 3–18 letters, numbers or underscores.");
  if (!cleanName || cleanName.length > 28) throw new Error("Student name must be between 1 and 28 characters.");
  const { data, error } = await client.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      data: { name: cleanName, username: cleanUsername, gender: gender === "female" ? "female" : "male" }
    }
  });
  if (error) throw error;
  // The database trigger creates the profile inside the auth.users transaction.
  // Do not upsert here: email-confirmation flows may have no session yet.
  let profile = null;
  if (data.session && data.user) {
    const { data: row, error: profileError } = await client.from("profiles")
      .select("username,display_name,gender,location")
      .eq("id", data.user.id).maybeSingle();
    if (profileError) throw profileError;
    profile = row;
  }
  return { ...data, profile };
}

// Process Supabase email-confirmation redirects. A confirmed student is
// deliberately signed out so they land on the login form and sign in themselves.
export async function handleEmailConfirmationRedirect() {
  if (!client) return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const errorCode = hash.get("error_code");
  const errorDescription = hash.get("error_description");
  if (errorCode || errorDescription) {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    return { ok: false, message: errorDescription ? errorDescription.replace(/\+/g, " ") : "Email confirmation failed. Request a new confirmation email." };
  }

  const isSignupConfirmation = hash.get("type") === "signup" || hash.has("access_token") || hash.has("code");
  if (!isSignupConfirmation) return null;

  // Supabase detects and exchanges the confirmation URL during client startup.
  const { data: { session }, error } = await client.auth.getSession();
  if (error) return { ok: false, message: error.message };
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  if (!session?.user) return { ok: false, message: "Your confirmation link could not be verified. Request a fresh email and try again." };

  const { error: signOutError } = await client.auth.signOut({ scope: "local" });
  if (signOutError) return { ok: false, message: "Your email was confirmed, but we could not finish the sign-out step. Please return to login." };
  return { ok: true, message: "Email confirmed successfully! You can now log in with your email address and password." };
}

export async function loginOnlineStudent(email, password) {
  if (!client) throw new Error("Online multiplayer is not configured yet.");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const meta = data.user.user_metadata || {};
  let { data: profile, error: profileError } = await client.from("profiles")
    .select("username,display_name,gender,location")
    .eq("id", data.user.id).maybeSingle();
  if (profileError) throw profileError;
  // Recover accounts created before the profile trigger/schema was installed.
  if (!profile) {
    const fallbackUsername = String(meta.username || data.user.email.split("@")[0]).replace(/[^A-Za-z0-9_]/g, "").slice(0, 18) || `student_${data.user.id.slice(0, 6)}`;
    const { data: created, error: createError } = await client.from("profiles").insert({
      id: data.user.id, username: fallbackUsername, display_name: String(meta.name || "Student").slice(0, 28),
      gender: meta.gender === "female" ? "female" : "male",
      location: meta.gender === "female" ? "Female Hostel" : "Male Hostel"
    }).select("username,display_name,gender,location").single();
    if (createError) throw createError;
    profile = created;
  }
  return {
    id: data.user.id,
    name: profile?.display_name || meta.name || "Student",
    username: profile?.username || meta.username || data.user.email.split("@")[0],
    gender: profile?.gender || meta.gender || "male",
    email: data.user.email
  };
}

export async function logoutOnlineStudent() {
  if (communityChannel && client) {
    try { await client.removeChannel(communityChannel); } finally { communityChannel = null; }
  }
  if (client) {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }
}

export async function publishPlayerPresence(profile, location) {
  if (!client || !profile?.id) return;
  const channel = client.channel("baze-life-campus", { config: { presence: { key: profile.id } } });
  await new Promise(resolve => channel.subscribe(async status => {
    if (status === "SUBSCRIBED") {
      await channel.track({ user_id: profile.id, username: profile.username,
        display_name: profile.name, gender: profile.gender, location,
        online_at: new Date().toISOString() });
      resolve();
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve();
  }));
  return channel;
}

export async function updateOnlineLocation(profile, location) {
  if (!client || !profile?.id) return;
  const seenAt = new Date().toISOString();
  const { error } = await client.from("profiles").update({ location, last_seen: seenAt }).eq("id", profile.id);
  if (error) throw error;
  if (communityChannel) await communityChannel.track({ user_id: profile.id, username: profile.username,
    display_name: profile.name, gender: profile.gender, location, online_at: seenAt });
}

export async function listOnlineProfiles(currentUserId) {
  if (!client) return [];
  const { data, error } = await client.from("profiles")
    .select("id,username,display_name,gender,location,last_seen")
    .neq("id", currentUserId).order("display_name");
  if (error) throw error;
  return data || [];
}

export async function searchRegisteredUsers(usernameQuery, currentUserId) {
  if (!client) throw new Error("Online user search requires an online account.");
  const query=String(usernameQuery||"").trim().replace(/^@/,"").slice(0,18);
  if(query.length<2) return [];
  const {data,error}=await client.from("profiles")
    .select("id,username,display_name,gender,location,last_seen")
    .ilike("username",`%${query}%`).neq("id",currentUserId).order("username").limit(20);
  if(error) throw error;
  return data||[];
}

export async function loadDirectMessages(currentUserId, otherUserId, limit=60) {
  if(!client||!currentUserId||!otherUserId) return [];
  const {data,error}=await client.from("direct_messages")
    .select("id,sender_id,recipient_id,body,created_at")
    .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`)
    .order("created_at",{ascending:true}).limit(limit);
  if(error) throw error;
  return data||[];
}

export async function sendDirectMessage(profile, recipientId, body) {
  if(!client||!profile?.id||!recipientId) throw new Error("Log in online to message another student.");
  const clean=String(body||"").trim().slice(0,500);
  if(!clean) return;
  const {error}=await client.from("direct_messages").insert({
    sender_id:profile.id,recipient_id:recipientId,body:clean
  });
  if(error) throw error;
}

export async function publishPlayerPosition(profile, location, position) {
  if(!client||!communityChannel||!profile?.id) return;
  await communityChannel.track({
    user_id:profile.id,username:profile.username,display_name:profile.name,
    gender:profile.gender,location,
    x:Number(position?.x||0),z:Number(position?.z||0),
    rotation:Number(position?.rotation||0),online_at:new Date().toISOString()
  });
}

export async function loadRecentMessages(limit = 40) {
  if (!client) return [];
  const { data, error } = await client.from("messages")
    .select("id,sender_id,sender_username,body,created_at")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).reverse();
}

export async function sendCampusMessage(profile, body) {
  if (!client || !profile?.id) throw new Error("Log in online to chat with other students.");
  const clean = String(body || "").trim().slice(0, 500);
  if (!clean) return;
  const { error } = await client.from("messages").insert({
    sender_id: profile.id, sender_username: profile.username, body: clean
  });
  if (error) throw error;
}

export async function subscribeToCampus(profile, location, onPresence, onMessage, onDirectMessage=()=>{}) {
  if (!client) return null;
  if (communityChannel) await client.removeChannel(communityChannel);
  communityChannel = client.channel("baze-life-campus", { config: { presence: { key: profile?.id || "community" } } });
  communityChannel
    .on("presence", { event: "sync" }, () => onPresence(communityChannel.presenceState()))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => onMessage(payload.new))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, payload => onDirectMessage(payload.new));
  await new Promise(resolve => communityChannel.subscribe(async status => {
    if (status === "SUBSCRIBED") {
      if (profile?.id) await communityChannel.track({ user_id: profile.id, username: profile.username, display_name: profile.name, gender: profile.gender, location, x:0, z:0, rotation:0, online_at: new Date().toISOString() });
      resolve();
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve();
  }));
  return communityChannel;
}
