module.exports = [
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: ['https://ice2508.github.io', 'https://payment.yookassa.ru'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    },
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];