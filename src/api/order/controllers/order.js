'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { YooCheckout } = require('@a2seven/yoo-checkout');
const { v4: uuidv4 } = require('uuid');

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
  // 1. Метод создания платежа (уже у вас есть, добавим только metadata)
  async create(ctx) {
    try {
      const { data } = ctx.request.body;
      if (!data || !data.productId) return ctx.badRequest('productId обязателен');

      const product = await strapi.entityService.findMany('api::base-price.base-price', {
        filters: { productId: data.productId },
        limit: 1,
      });

      if (!product || product.length === 0) return ctx.notFound('Товар не найден');

      const order = await strapi.entityService.create('api::order.order', {
        data: {
          productId: data.productId,
          amount: product[0].price,
          statusOrder: 'pending',
        },
      });

      const checkout = new YooCheckout({
        shopId: process.env.YUKASSA_SHOP_ID,
        secretKey: process.env.YUKASSA_SECRET_KEY,
      });

      const amountValue = Number(order.amount).toFixed(2);

      const paymentData = {
        amount: { value: amountValue, currency: 'RUB' },
        confirmation: {
          type: 'redirect',
          return_url: 'https://ice2508.github.io/frontend-order/',
        },
        capture: true,
        description: `Оплата заказа #${order.id}`,
        metadata: {
          orderId: order.id, // ВАЖНО: передаем ID заказа в метаданных
        },
      };

      const idempotenceKey = uuidv4();
      const payment = await checkout.createPayment(paymentData, idempotenceKey);

      await strapi.entityService.update('api::order.order', order.id, {
        data: { paymentId: payment.id },
      });

      return ctx.send({ confirmation_url: payment.confirmation.confirmation_url });
    } catch (err) {
      console.error('[CREATE ERROR]:', err);
      return ctx.internalServerError(`Ошибка оплаты: ${err.message}`);
    }
  },

  // 2. НОВЫЙ МЕТОД: Обработка вебхука
  async webhook(ctx) {
    const { event, object } = ctx.request.body;

    console.log(`[WEBHOOK] Получено событие: ${event}`);

    // Проверяем, что событие — это успешная оплата
    if (event === 'payment.succeeded') {
      const paymentId = object.id;
      const orderId = object.metadata.orderId; // Достаем ID заказа из метаданных

      console.log(`[WEBHOOK] Платеж ${paymentId} успешен для заказа ${orderId}`);

      try {
        // Ищем заказ в БД
        const order = await strapi.entityService.findOne('api::order.order', orderId);

        if (order) {
          // Обновляем статус заказа
          await strapi.entityService.update('api::order.order', orderId, {
            data: {
              statusOrder: 'paid',
            },
          });
          console.log(`[WEBHOOK] Статус заказа #${orderId} успешно изменен на paid`);
        } else {
          console.error(`[WEBHOOK] Заказ #${orderId} не найден`);
        }
      } catch (err) {
        console.error('[WEBHOOK ERROR]:', err);
      }
    }

    // ЮKassa ожидает ответ 200 OK, чтобы перестать слать уведомления
    return ctx.send({ status: 'ok' });
  },
}));