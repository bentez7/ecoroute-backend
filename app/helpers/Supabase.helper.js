'use strict';

const { serviceClient } = require('@database');

/**
 * Fetch rows from a table with optional equality filters.
 * @param {string} table
 * @param {string} columns  — '*' or comma-separated column names
 * @param {Object} filters  — key/value equality filters
 */
async function selectRows(table, columns = '*', filters = {}) {
  let query = serviceClient.from(table).select(columns);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  return query;
}

/**
 * Insert one or more rows and return inserted data.
 * @param {string} table
 * @param {Object|Object[]} payload
 */
async function insertRows(table, payload) {
  return serviceClient.from(table).insert(payload).select();
}

/**
 * Update rows matching filters and return updated data.
 * @param {string} table
 * @param {Object} updates
 * @param {Object} filters  — key/value equality filters
 */
async function updateRows(table, updates, filters = {}) {
  let query = serviceClient.from(table).update(updates);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  return query.select();
}

module.exports = { selectRows, insertRows, updateRows };
