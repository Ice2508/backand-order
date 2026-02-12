module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',

  // Настройка CORS
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'https://ice2508.github.io',      // правильно, без пути
        'https://payment.yookassa.ru'    // ЮKassa webhook
      ],
      headers: '*',
      methods: ['GET','POST','PUT','DELETE','OPTIONS']
    }
  },

  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];