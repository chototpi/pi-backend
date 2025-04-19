require('dotenv').config(); // dòng này load biến môi trường từ .env
const { Pi } = require('@pi-network/pi-backend-sdk');

const pi = new Pi({
  apiKey: process.env.PI_API_KEY,
  secretKey: process.env.PI_SECRET_KEY,
  environment: 'sandbox', // hoặc 'production' nếu là app thật
});

module.exports = pi;