module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/orders/webhook',
      handler: 'order.webhook',
      config: {
        auth: false, // Вебхук должен быть публичным
      },
    },
    // Оставляем стандартные роуты, если нужно
    {
      method: 'POST',
      path: '/orders',
      handler: 'order.create',
    },
  ]
}