// Authentication layer - Supabase Auth (email + password) only.
// No custom/local accounts. Users must be created in the Supabase
// dashboard under Authentication -> Users.
import { supabase } from './supabase-client.js';

let currentSession = null;
const listeners = [];

export function onAuthChange(callback) {
  listeners.push(callback);
}

function notify() {
  for (const cb of listeners) cb(currentSession);
}

export function getSession() {
  return currentSession;
}

export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;
  notify();

  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    notify();
  });
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, error: error.message };
  }
  currentSession = data.session;
  return { success: true };
}

export async function logout() {
  await supabase.auth.signOut();
  currentSession = null;
}
