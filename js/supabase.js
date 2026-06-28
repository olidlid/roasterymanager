// SUPABASE CLIENT INITIALIZATION (ES MODULE)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Retrieve Supabase credentials from localStorage for self-hosted portability
let supabaseUrl = localStorage.getItem('supabase_url') || '';
let supabaseKey = localStorage.getItem('supabase_key') || '';

export let supabase = null;

/**
 * Check if the database connection details are configured.
 */
export function isConnected() {
    return supabaseUrl !== '' && supabaseKey !== '' && supabase !== null;
}

/**
 * Initialize Supabase client and save keys to localStorage.
 */
export function initSupabase(url, key) {
    if (!url || !key) return false;
    try {
        // Trim whitespace from keys
        const cleanUrl = url.trim();
        const cleanKey = key.trim();
        
        supabase = createClient(cleanUrl, cleanKey);
        supabaseUrl = cleanUrl;
        supabaseKey = cleanKey;
        
        localStorage.setItem('supabase_url', cleanUrl);
        localStorage.setItem('supabase_key', cleanKey);
        
        console.log("Supabase Client initialized successfully.");
        return true;
    } catch (e) {
        console.error("Failed to initialize Supabase:", e);
        return false;
    }
}

/**
 * Clear connection settings (disconnect from database).
 */
export function disconnectSupabase() {
    supabase = null;
    supabaseUrl = '';
    supabaseKey = '';
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    console.log("Supabase connection reset.");
}

// Auto-initialize if keys are already saved
if (supabaseUrl && supabaseKey) {
    initSupabase(supabaseUrl, supabaseKey);
}
