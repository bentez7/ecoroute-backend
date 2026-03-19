'use strict';

// 1. Load env vars FIRST — before any other require
require('dotenv').config();

// 2. Register module-alias SECOND — before any @alias requires
require('module-alias/register');

// 3. Safe to use @aliases from here
const express         = require('express');
const cors            = require('cors');
const helmet          = require('helmet');
const morgan          = require('morgan');
const swaggerUi       = require('swagger-ui-express');
const swaggerSpec     = require('./app/config/swagger.conf');

const { appConf }      = require('@config');
const { errorHandler } = require('@middleware');
const { mountRoutes }  = require('@routes');
const Logger           = require('@utils/Logger.util');

const app = express();

// ── Security + parsing ────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: appConf.CORS_ORIGINS, credentials: true }));
app.use(morgan(appConf.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Swagger UI ────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ────────────────────────────────────────────────────
mountRoutes(app);

// ── Global error handler (must be last) ──────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
app.listen(appConf.PORT, () => {
  Logger.info(`EcoRoute backend running on port ${appConf.PORT} [${appConf.NODE_ENV}]`);
});

module.exports = app;
