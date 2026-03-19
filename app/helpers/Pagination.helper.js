'use strict';

/**
 * Paginate an array of items based on query params.
 * @param {Array} items  — full list to paginate
 * @param {Object} query — Express req.query (expects optional `page` and `limit`)
 * @returns {{ data: Array, pagination: { page, limit, total, total_pages } }}
 */
function paginate(items, query = {}) {
  const page  = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = items.slice(offset, offset + limit);

  return {
    data,
    pagination: { page, limit, total, total_pages: totalPages },
  };
}

module.exports = { paginate };
