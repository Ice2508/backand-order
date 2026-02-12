'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::order.order', ({ strapi }) => ({

  // Переопределяем стандартный метод create
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

}));

