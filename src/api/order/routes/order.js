'use strict';

/**
 * order router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

// Берём стандартные CRUD роуты
const coreRouter = createCoreRouter('api::order.order');

// Добавляем кастомный роут для оплаты
coreRouter.routes.push({
  method: 'POST',
  path: '/order/pay',
  handler: 'order.createPayment',
  config: {
    auth: false // Public доступ
  }
});

module.exports = coreRouter;
