'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { YooCheckout } = require('@a2seven/yoo-checkout'); 
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
  // ==========================
  // Создание заказа + платеж
  // ==========================
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

      // 3️⃣ Инициализация YooKassa
      const checkout = new YooCheckout({
        shopId: process.env.YUKASSA_SHOP_ID,
        secretKey: process.env.YUKASSA_SECRET_KEY,
      });

      const amountValue = Number(order.amount).toFixed(2); 
      console.log('[LOG] Итоговая сумма для YooKassa:', amountValue);

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

      // 5️⃣ Сохраняем paymentId в заказе
      await strapi.entityService.update('api::order.order', order.id, {
        data: { paymentId: payment.id },
      });

      return ctx.send({
        confirmation_url: payment.confirmation.confirmation_url,
      });

    } catch (err) {
      console.error('[FULL ERROR]:', err);
      const errorMessage = err.response?.data?.description || err.message;
      return ctx.internalServerError(`Ошибка оплаты: ${errorMessage}`);
    }
  },

  // ==========================
  // Webhook от YooKassa
  // ==========================
  async webhook(ctx) {
    try {
      const body = ctx.request.body;
      const signature = ctx.request.headers['http_yoo_signature'];

      // Проверка подписи
      const hash = crypto.createHmac('sha256', process.env.YUKASSA_SECRET_KEY)
                         .update(JSON.stringify(body))
                         .digest('base64');

      if (hash !== signature) {
        console.warn('[WEBHOOK] Неверная подпись');
        return ctx.forbidden('Неверная подпись');
      }

      console.log('[WEBHOOK] Получен callback:', body);

      const { event, object } = body;

      if (event === 'payment.succeeded') {
        const paymentId = object.id;

        // Находим заказ по paymentId
        const orders = await strapi.entityService.findMany('api::order.order', {
          filters: { paymentId },
          limit: 1,
        });

        if (orders.length === 0) {
          console.warn('[WEBHOOK] Заказ не найден для paymentId:', paymentId);
          return ctx.notFound('Заказ не найден');
        }

        const order = orders[0];

        // Меняем статус на 'paid'
        await strapi.entityService.update('api::order.order', order.id, {
          data: { statusOrder: 'paid' },
        });

        console.log(`[WEBHOOK] Статус заказа #${order.id} обновлён на 'paid'`);

        return ctx.send({ message: 'Статус заказа обновлён' });
      }

      // Игнорируем другие события
      return ctx.send({ message: 'Событие не обработано' });

    } catch (err) {
      console.error('[WEBHOOK ERROR]:', err);
      return ctx.internalServerError('Ошибка при обработке webhook');
    }
  },

}));