'use strict';

const keys = require('./app.keys');

module.exports = {
  supabaseUrl:            keys.SUPABASE_URL,
  supabaseAnonKey:        keys.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: keys.SUPABASE_SERVICE_ROLE_KEY,
};
