'use strict';

const { requireAuth }            = require('./Auth.middleware');
const { requireServiceRole }     = require('./ServiceRole.middleware');
const { errorHandler }           = require('./ErrorHandler.middleware');
const { handleValidationErrors } = require('./Validate.middleware');

module.exports = { requireAuth, requireServiceRole, errorHandler, handleValidationErrors };
