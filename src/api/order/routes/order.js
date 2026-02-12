'use strict';

/**
 * Order routes
 *
 * Этот файл содержит:
 * 1. Стандартные CRUD роуты (create, find, findOne, update, delete) через createCoreRouter
 * 2. Кастомный роут POST /order/pay для оплаты через ЮKassa
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

// Берём стандартные CRUD роуты
const coreRouter = createCoreRouter('api::order.order');

// **Важно:** кастомный метод отдельно через config.routes
// Strapi Cloud не любит, когда мы мутируем coreRouter.routes напрямую
const customRoutes = [
  {
    method: 'POST',
    path: '/order/pay',
    handler: 'order.createPayment',
    config: {
      auth: false, // Public доступ
    },
  },
];

module.exports = {
  ...coreRouter, // стандартные CRUD роуты
  routes: [...coreRouter.routes, ...customRoutes], // добавляем кастомный
};
