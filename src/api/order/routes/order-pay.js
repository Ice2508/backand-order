'use strict';

/**
 * Кастомный роут для оплаты через ЮKassa
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/order/pay',
      handler: 'order.createPayment',
      config: {
        auth: false, // публичный доступ
      },
    },
  ],
};