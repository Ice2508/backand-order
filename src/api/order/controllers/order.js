'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const YooCheckout = require('@a2seven/yoo-checkout');

module.exports = createCoreController('api::order.order', ({ strapi }) => ({

  async createPayment(ctx) {
    try {
      const { id } = ctx.request.body;
      console.log('[LOG] Получен ID заказа:', id);

      if (!id) return ctx.badRequest('Order id обязателен');

      const order = await strapi.db.query('api::order.order').findOne({ where: { id } });
      console.log('[LOG] Найден заказ:', order);

      if (!order) return ctx.notFound('Заказ не найден');

      // Проверяем ключи
      console.log('[LOG] YUKASSA_SHOP_ID:', process.env.YUKASSA_SHOP_ID);
      console.log('[LOG] YUKASSA_SECRET_KEY:', process.env.YUKASSA_SECRET_KEY ? 'Задан' : 'Не задан');

      const checkout = new YooCheckout({
        shopId: process.env.YUKASSA_SHOP_ID,
        secretKey: process.env.YUKASSA_SECRET_KEY,
      });

      // Проверяем сумму
      const amountValue = (order.amount / 100).toFixed(2);
      console.log('[LOG] Сумма для платежа:', amountValue);

      const paymentData = {
        amount: { value: amountValue, currency: 'RUB' },
        confirmation: { type: 'redirect', return_url: 'http://localhost:3000/success' },
        description: `Оплата заказа #${order.id}`,
        metadata: { orderId: order.id },
      };
      console.log('[LOG] paymentData:', paymentData);

      let payment;
      try {
        payment = await checkout.createPayment(paymentData);
        console.log('[LOG] Ответ YooCheckout:', payment);
      } catch (sdkErr) {
        console.error('[ERROR] Ошибка при создании платежа через YooCheckout:', sdkErr);
        return ctx.internalServerError('Ошибка SDK YooCheckout: ' + (sdkErr.message || sdkErr));
      }

      await strapi.db.query('api::order.order').update({
        where: { id: order.id },
        data: { paymentId: payment.id },
      });
      console.log('[LOG] paymentId сохранён в заказе:', payment.id);

      return ctx.send({ confirmation_url: payment.confirmation.confirmation_url });

    } catch (err) {
      console.error('[ERROR] createPayment общий catch:', err);
      return ctx.internalServerError('Ошибка при создании платежа: ' + (err.message || err));
    }
  }

}));