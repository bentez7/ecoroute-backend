'use strict';

module.exports = {
  PORT:         parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV:     process.env.NODE_ENV || 'development',
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'],
};
