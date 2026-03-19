'use strict';

const { anonClient, serviceClient } = require('./Supabase.database');
const models = require('./models');

module.exports = { anonClient, serviceClient, models };
