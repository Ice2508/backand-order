'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::order.order', ({ strapi }) => ({

  // Создание заказа с подтягиванием суммы из BasePrice
  async create(ctx) {
    try {
      const { productId } = ctx.request.body.data;

      if (!productId) {
        return ctx.badRequest('productId обязателен');
      }

      // Берём цену из базы BasePrice
      const product = await strapi.db.query('api::base-price.base-price').findOne({
        where: { productId },
      });

      if (!product) {
        return ctx.notFound('Товар не найден в базе BasePrice');
      }

      if (typeof product.price !== 'number') {
        return ctx.badRequest('Цена товара не задана');
      }

      // Создаём заказ с корректной суммой
      const order = await strapi.db.query('api::order.order').create({
        data: {
          productId,
          amount: product.price,
          statusOrder: 'pending',
        },
      });

      return ctx.send({ data: order });

    } catch (err) {
      console.error('[ERROR] Ошибка при создании заказа:', err);
      return ctx.internalServerError('Ошибка при создании заказа');
    }
  },

}));