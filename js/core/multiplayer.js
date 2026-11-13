import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

let client = null;
let communityChannel = null;
let communityProfile = null;
let communityLocation = "Campus";
let communityStatus = "CLOSED";
let lastPresencePosition = { x: 0, z: 2.5, rotation: 0 };
let lastPositionBroadcastAt = 0;
let lastPresenceTrackAt = 0;
let presenceTrackTimer = null;
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
  communityProfile = null;
  communityLocation = "Campus";
  communityStatus = "CLOSED";
  lastPresencePosition = { x: 0, z: 2.5, rotation: 0 };
  lastPositionBroadcastAt = 0;
  lastPresenceTrackAt = 0;
  if (presenceTrackTimer) clearTimeout(presenceTrackTimer);
  presenceTrackTimer = null;
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

  // Presence is only for slow-changing state (identity and room).
  // Position updates travel over Broadcast to avoid Supabase's per-client
  // Presence limit. Only re-track when the room actually changes.
  const locationChanged = communityLocation !== location;
  communityLocation = location;
  if (locationChanged && communityProfile?.id === profile.id && communityStatus === "SUBSCRIBED") {
    await trackCommunityPresence();
  }
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

export async function loadDirectInbox(currentUserId, limit=80) {
  if(!client||!currentUserId) return [];
  const {data:messages,error}=await client.from("direct_messages")
    .select("id,sender_id,recipient_id,body,created_at")
    .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
    .order("created_at",{ascending:false}).limit(limit);
  if(error) throw error;
  const peerIds=[...new Set((messages||[]).map(m=>m.sender_id===currentUserId?m.recipient_id:m.sender_id).filter(Boolean))];
  if(!peerIds.length) return [];
  const {data:profiles,error:profileError}=await client.from("profiles")
    .select("id,username,display_name,gender,location").in("id",peerIds);
  if(profileError) throw profileError;
  const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
  const conversations=new Map();
  for(const message of messages||[]){
    const peerId=message.sender_id===currentUserId?message.recipient_id:message.sender_id;
    if(!conversations.has(peerId)){
      conversations.set(peerId,{user:profileMap.get(peerId)||{id:peerId,username:"student",display_name:"Student",gender:"male"},lastMessage:message,messages:[]});
    }
    conversations.get(peerId).messages.push(message);
  }
  return [...conversations.values()];
}

export async function sendDirectMessage(profile, recipientId, body) {
  if(!client||!profile?.id||!recipientId) throw new Error("Log in online to message another student.");
  const clean=String(body||"").trim().slice(0,500);
  if(!clean) return;

  // Use the authenticated Supabase account as the sender, never a stale UI
  // profile object. This keeps sender_id aligned with auth.uid() in the RLS rule.
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) throw new Error("Your online session has expired. Log out and sign in again.");
  if (user.id !== profile.id) {
    throw new Error("Your active Supabase login does not match this game profile. Log out and sign in again.");
  }
  if (user.id === recipientId) throw new Error("You cannot send a private message to yourself.");

  const { error } = await client.from("direct_messages").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    body: clean
  });
  if (error) throw error;
}

async function trackCommunityPresence() {
  if (!client || !communityChannel || communityStatus !== "SUBSCRIBED" || !communityProfile?.id) return false;

  // Supabase currently permits at most 5 Presence updates per client in 30s.
  // Keep a safety margin and coalesce rapid room changes into one latest state.
  const cooldownMs = 8000;
  const elapsed = Date.now() - lastPresenceTrackAt;
  if (lastPresenceTrackAt && elapsed < cooldownMs) {
    if (!presenceTrackTimer) {
      presenceTrackTimer = setTimeout(() => {
        presenceTrackTimer = null;
        trackCommunityPresence().catch(error => console.warn("Presence room update failed.", error));
      }, cooldownMs - elapsed + 100);
    }
    return true;
  }

  const result = await communityChannel.track({
    user_id: communityProfile.id,
    username: communityProfile.username,
    display_name: communityProfile.name,
    gender: communityProfile.gender,
    location: communityLocation,
    x: lastPresencePosition.x,
    z: lastPresencePosition.z,
    rotation: lastPresencePosition.rotation,
    online_at: new Date().toISOString()
  });
  if (result !== "ok") throw new Error(`Supabase presence update failed: ${result}.`);
  lastPresenceTrackAt = Date.now();
  return true;
}

export async function publishPlayerPosition(profile, location, position) {
  if (!client || !communityChannel || !profile?.id || communityStatus !== "SUBSCRIBED") return;
  if (communityProfile?.id !== profile.id) return;

  // Position is high-frequency game state: send Broadcast, not Presence.
  // Presence is reserved for online identity and current room only.
  const now = Date.now();
  if (now - lastPositionBroadcastAt < 300) return;
  lastPositionBroadcastAt = now;

  communityLocation = location;
  const payload = {
    user_id: profile.id,
    username: profile.username,
    display_name: profile.name,
    gender: profile.gender,
    location,
    x: Number.isFinite(Number(position?.x)) ? Number(position.x) : 0,
    z: Number.isFinite(Number(position?.z)) ? Number(position.z) : 2.5,
    rotation: Number.isFinite(Number(position?.rotation)) ? Number(position.rotation) : 0,
    sent_at: new Date(now).toISOString()
  };
  const result = await communityChannel.send({
    type: "broadcast",
    event: "player_position",
    payload
  });
  if (result === "error" || result === "timed out") {
    throw new Error("Supabase Realtime could not broadcast your player position.");
  }
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

export async function subscribeToCampus(profile, location, onPresence, onMessage, onDirectMessage=()=>{}, onStatus=()=>{}) {
  if (!client || !profile?.id) throw new Error("Online sign-in is required for campus presence.");
  if (communityChannel) await client.removeChannel(communityChannel);

  communityProfile = profile;
  communityLocation = location;
  communityStatus = "CONNECTING";
  lastPresencePosition = { x: 0, z: 2.5, rotation: 0 };
  lastPositionBroadcastAt = 0;
  lastPresenceTrackAt = 0;
  if (presenceTrackTimer) clearTimeout(presenceTrackTimer);
  presenceTrackTimer = null;

  communityChannel = client.channel("baze-life-campus", {
    config: {
      presence: { key: profile.id },
      broadcast: { ack: true }
    }
  });
  communityChannel
    .on("presence", { event: "sync" }, () => {
      try { onPresence(communityChannel.presenceState()); }
      catch (error) { console.error("Could not render campus presence roster.", error); }
    })
    .on("broadcast", { event: "player_position" }, event => {
      const update = event?.payload;
      if (!update?.user_id || update.user_id === profile.id) return;
      try {
        const presence = communityChannel.presenceState();
        let matched = false;
        const nextPresence = {};
        for (const [key, entries] of Object.entries(presence)) {
          nextPresence[key] = (Array.isArray(entries) ? entries : []).map(entry => {
            if (entry?.user_id !== update.user_id) return entry;
            matched = true;
            return { ...entry, ...update };
          });
        }
        if (matched) onPresence(nextPresence);
      } catch (error) {
        console.error("Could not apply remote player position.", error);
      }
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => onMessage(payload.new))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${profile.id}` }, payload => {
      if(payload?.new?.recipient_id===profile.id && payload.new.sender_id!==profile.id) onDirectMessage(payload.new);
    });

  await new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      communityStatus = "TIMED_OUT";
      reject(new Error("Supabase Realtime did not connect within 15 seconds. Check the Realtime service and browser network."));
    }, 15000);

    communityChannel.subscribe(async status => {
      onStatus(status);
      if (status === "SUBSCRIBED") {
        communityStatus = status;
        if (settled) return;
        try {
          await trackCommunityPresence(lastPresencePosition);
          // Do an immediate snapshot after tracking. Relying only on a later
          // presence sync can leave the first roster empty until another join.
          onPresence(communityChannel.presenceState());
          settled = true;
          clearTimeout(timeout);
          resolve();
        } catch (error) {
          settled = true;
          clearTimeout(timeout);
          communityStatus = "ERROR";
          reject(error);
        }
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        communityStatus = status;
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Supabase Realtime channel failed: ${status}. Check the Supabase Realtime settings and browser console.`));
      }
    });
  });

  return communityChannel;
}
