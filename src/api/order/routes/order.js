'use strict';

/**
 * Order routes
 *
 * Стандартные CRUD-роуты:
 * - GET    /api/order        → find
 * - GET    /api/order/:id    → findOne
 * - POST   /api/order        → create
 * - PUT    /api/order/:id    → update
 * - DELETE /api/order/:id    → delete
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::order.order');
