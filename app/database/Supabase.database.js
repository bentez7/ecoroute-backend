'use strict';

const { createClient } = require('@supabase/supabase-js');
const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = require('@config').dbConf;

const anonClient = createClient(supabaseUrl, supabaseAnonKey);

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken:   false,
    persistSession:     false,
    detectSessionInUrl: false,
  },
});

module.exports = { anonClient, serviceClient };
