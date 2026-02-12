'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const YooCheckout = require('@a2seven/yoo-checkout');

module.exports = createCoreController('api::order.order', ({ strapi }) => ({

  async create(ctx) {
    try {
      const { productId } = ctx.request.body.data;

      if (!productId) {
        return ctx.badRequest('productId обязателен');
      }

      // 1️⃣ Берём цену из BasePrice
      const product = await strapi.db.query('api::base-price.base-price').findOne({
        where: { productId },
      });

      if (!product) {
        return ctx.notFound('Товар не найден');
      }

      if (typeof product.price !== 'number') {
        return ctx.badRequest('Цена товара не задана');
      }

      // 2️⃣ Создаём заказ
      const order = await strapi.db.query('api::order.order').create({
        data: {
          productId,
          amount: product.price,
          statusOrder: 'pending',
        },
      });

      // 3️⃣ Инициализация YooKassa
      const checkout = new YooCheckout({
        shopId: process.env.YUKASSA_SHOP_ID,
        secretKey: process.env.YUKASSA_SECRET_KEY,
      });

      const amountValue = (order.amount / 100).toFixed(2);

      const paymentData = {
        amount: {
          value: amountValue,
          currency: 'RUB',
        },
        confirmation: {
          type: 'redirect',
          return_url: 'https://ice2508.github.io/frontend-order/',
        },
        capture: true,
        description: `Оплата заказа #${order.id}`,
        metadata: {
          orderId: order.id,
        },
      };

      // 4️⃣ Создаём платёж в YooKassa
      const payment = await checkout.createPayment(paymentData);

      // 5️⃣ Сохраняем paymentId
      await strapi.db.query('api::order.order').update({
        where: { id: order.id },
        data: {
          paymentId: payment.id,
        },
      });

      // 6️⃣ Возвращаем ссылку на оплату
      return ctx.send({
        confirmation_url: payment.confirmation.confirmation_url,
      });

    } catch (err) {
      console.error('[ERROR] create order + payment:', err);
      return ctx.internalServerError('Ошибка при создании заказа и платежа');
    }
  },

}));