'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const YooCheckout = require('@a2seven/yoo-checkout');

module.exports = createCoreController('api::order.order', ({ strapi }) => ({

  // Метод создания заказа
  async create(ctx) {
    try {
      const { productId } = ctx.request.body.data;

      if (!productId) return ctx.badRequest('productId обязателен');

      // Берём цену из BasePrice
      const product = await strapi.db.query('api::base-price.base-price').findOne({
        where: { productId },
      });

      if (!product) return ctx.notFound('Товар не найден в базе BasePrice');

      // Создаём заказ с правильной суммой
      const order = await strapi.db.query('api::order.order').create({
        data: {
          productId,
          amount: product.price,
          statusOrder: 'pending',
        },
      });

      ctx.send({ data: order });

    } catch (err) {
      console.error(err);
      ctx.internalServerError('Ошибка при создании заказа');
    }
  },

  // Метод для оплаты через ЮKassa
  async createPayment(ctx) {
    try {
      const { id } = ctx.request.body; // id заказа из frontend

      if (!id) return ctx.badRequest('Order id обязателен');

      // Ищем заказ
      const order = await strapi.db.query('api::order.order').findOne({
        where: { id },
      });

      if (!order) return ctx.notFound('Заказ не найден');

      // Инициализация SDK ЮKassa
      const checkout = new YooCheckout({
        shopId: process.env.YUKASSA_SHOP_ID,
        secretKey: process.env.YUKASSA_SECRET_KEY
      });

      // Данные для создания платежа
      const paymentData = {
        amount: {
          value: (order.amount / 100).toFixed(2), // сумма в рублях
          currency: 'RUB'
        },
        confirmation: {
          type: 'redirect',
          return_url: 'http://localhost:3000/success' // куда юзер вернётся после оплаты
        },
        description: `Оплата заказа #${order.id}`,
        metadata: {
          orderId: order.id
        }
      };

      // Создаём платёж
      const payment = await checkout.createPayment(paymentData);

      // Сохраняем paymentId в заказе
      await strapi.db.query('api::order.order').update({
        where: { id: order.id },
        data: { paymentId: payment.id }
      });

      // Отправляем фронтенду ссылку для редиректа на оплату
      return ctx.send({ confirmation_url: payment.confirmation.confirmation_url });

    } catch (err) {
      console.error(err);
      return ctx.internalServerError('Ошибка при создании платежа');
    }
  }

}));