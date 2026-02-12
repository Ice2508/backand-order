'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { YooCheckout } = require('@a2seven/yoo-checkout'); 
const { v4: uuidv4 } = require('uuid');

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
  async create(ctx) {
    try {
      console.log('[LOG] Request body:', ctx.request.body);

      const { data } = ctx.request.body;

      if (!data || !data.productId) {
        return ctx.badRequest('productId обязателен');
      }

      const { productId } = data;

      // 1️⃣ Ищем цену товара
      const product = await strapi.entityService.findMany('api::base-price.base-price', {
        filters: { productId },
        limit: 1,
      });

      if (!product || product.length === 0) {
        return ctx.notFound('Товар не найден');
      }

      const productData = product[0];

      // 2️⃣ Создаём заказ в БД
      const order = await strapi.entityService.create('api::order.order', {
        data: {
          productId,
          amount: productData.price,
          statusOrder: 'pending',
        },
      });

      // 3️⃣ Инициализация YooKassa (ОБЯЗАТЕЛЬНО с new)
      const checkout = new YooCheckout({ // <--- ДОБАВЛЕНО 'new'
        shopId: process.env.YUKASSA_SHOP_ID,
        secretKey: process.env.YUKASSA_SECRET_KEY,
      });

      // Логика суммы: если в базе 55000 — это рубли, то просто делаем .toFixed(2)
      // Если в базе копейки — тогда делим на 100.
      // Судя по вашим логам (цена 55000), скорее всего это рубли.
      const amountValue = Number(order.amount).toFixed(2); 
      
      console.log('[LOG] Итоговая сумма для ЮKassa:', amountValue);

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

      // 4️⃣ Создаём платёж
      const idempotenceKey = uuidv4();
      const payment = await checkout.createPayment(paymentData, idempotenceKey);
      
      console.log('[LOG] Платёж создан успешно, ID:', payment.id);

      // 5️⃣ Обновляем заказ, сохраняя paymentId
      await strapi.entityService.update('api::order.order', order.id, {
        data: {
          paymentId: payment.id,
        },
      });

      return ctx.send({
        confirmation_url: payment.confirmation.confirmation_url,
      });

    } catch (err) {
      console.error('[FULL ERROR]:', err);
      // Если это ошибка от API ЮKassa, в ней может быть полезное описание
      const errorMessage = err.response?.data?.description || err.message;
      return ctx.internalServerError(`Ошибка оплаты: ${errorMessage}`);
    }
  },
}));