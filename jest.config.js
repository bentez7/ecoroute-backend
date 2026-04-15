'use strict';

const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  moduleNameMapper: {
    '^@config$':      path.resolve(__dirname, 'app/config/init.js'),
    '^@config/(.*)$': path.resolve(__dirname, 'app/config/$1'),
    '^@database$':      path.resolve(__dirname, 'app/database/init.js'),
    '^@database/(.*)$': path.resolve(__dirname, 'app/database/$1'),
    '^@routes$':      path.resolve(__dirname, 'app/routes/init.js'),
    '^@routes/(.*)$': path.resolve(__dirname, 'app/routes/$1'),
    '^@controllers$':      path.resolve(__dirname, 'app/controllers'),
    '^@controllers/(.*)$': path.resolve(__dirname, 'app/controllers/$1'),
    '^@middleware$':      path.resolve(__dirname, 'app/middleware/init.js'),
    '^@middleware/(.*)$': path.resolve(__dirname, 'app/middleware/$1'),
    '^@helpers$':      path.resolve(__dirname, 'app/helpers'),
    '^@helpers/(.*)$': path.resolve(__dirname, 'app/helpers/$1'),
    '^@utils$':      path.resolve(__dirname, 'app/utils'),
    '^@utils/(.*)$': path.resolve(__dirname, 'app/utils/$1'),
    '^@services$':      path.resolve(__dirname, 'app/services/init.js'),
    '^@services/(.*)$': path.resolve(__dirname, 'app/services/$1'),
    '^@dto$':      path.resolve(__dirname, 'app/dto/index.js'),
    '^@dto/(.*)$': path.resolve(__dirname, 'app/dto/$1'),
  },
};
