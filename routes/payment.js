const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const { username, amount, memo } = req.body;

  // Giả lập tạo thanh toán (sau này bạn sẽ gọi Pi Payments API ở đây)
  const paymentId = 'demo_' + Date.now(); // thay bằng gọi thật

  res.json({
    message: 'Tạo thanh toán thành công',
    paymentId,
    explorerUrl: `https://pi-blockchain.net/payment/${paymentId}` // ví dụ thôi
  });
});

module.exports = router;
