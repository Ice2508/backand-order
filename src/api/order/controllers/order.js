'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const YooCheckout = require('@a2seven/yoo-checkout');
const { v4: uuidv4 } = require('uuid'); // Для idempotence key

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
  async create(ctx) {
    try {
      console.log('[LOG] Request body:', ctx.request.body);

      const { data } = ctx.request.body;

      if (!data || !data.productId) {
        console.error('[ERROR] productId отсутствует в запросе');
        return ctx.badRequest('productId обязателен');
      }

      const { productId } = data;
      console.log('[LOG] productId:', productId);

      // 1️⃣ Берём цену из BasePrice
      const product = await strapi.entityService.findMany('api::base-price.base-price', {
        filters: { productId },
        limit: 1,
      });

      if (!product || product.length === 0) {
        console.error('[ERROR] Товар не найден для productId:', productId);
        return ctx.notFound('Товар не найден');
      }

      const productData = product[0];
      console.log('[LOG] Найден продукт:', productData);

      if (typeof productData.price !== 'number') {
        console.error('[ERROR] Цена товара не задана:', productData.price);
        return ctx.badRequest('Цена товара не задана');
      }

      // 2️⃣ Создаём заказ
      const order = await strapi.entityService.create('api::order.order', {
        data: {
          productId,
          amount: productData.price,
          statusOrder: 'pending',
        },
      });
      console.log('[LOG] Создан заказ:', order);

      // 3️⃣ Инициализация YooKassa
      console.log('[LOG] Используем ключи YooKassa:',
        process.env.YUKASSA_SHOP_ID,
        process.env.YUKASSA_SECRET_KEY ? 'OK' : 'NOT FOUND'
      );

      const checkout = new YooCheckout({
        shopId: process.env.YUKASSA_SHOP_ID,
        secretKey: process.env.YUKASSA_SECRET_KEY,
      });

      const amountValue = (order.amount / 100).toFixed(2); // делим на 100, чтобы в рублях с копейками
      console.log('[LOG] amountValue для YooKassa:', amountValue);

      const paymentData = {
        amount: {
          value: amountValue.toString(),
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

      // 4️⃣ Создаём платёж в YooKassa с уникальным ключом
      console.log('[LOG] Создаём платёж в YooKassa...');
      const payment = await checkout.createPayment(paymentData, uuidv4());
      console.log('[LOG] Платёж создан:', payment);

      // 5️⃣ Сохраняем paymentId
      const updatedOrder = await strapi.entityService.update('api::order.order', order.id, {
        data: {
          paymentId: payment.id,
        },
      });
      console.log('[LOG] Заказ обновлён с paymentId:', updatedOrder);

      // 6️⃣ Возвращаем ссылку на оплату
      return ctx.send({
        confirmation_url: payment.confirmation.confirmation_url,
      });

    } catch (err) {
      console.error('[FULL ERROR] create order + payment:', err);
      return ctx.internalServerError(err.message || 'Ошибка при создании заказа и платежа');
    }
  },
}));