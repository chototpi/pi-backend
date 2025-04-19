const express = require('express');
const router = express.Router();
const pi = require('../pi');

const payments = {}; // Tạm lưu thông tin giao dịch (chỉ dùng cho test, sau này nên dùng database)

// Route tạo thanh toán
router.post('/create-payment', async (req, res) => {
  const { uid, username, amount, memo } = req.body;

  try {
    const paymentData = {
      amount: amount,
      memo: memo,
      metadata: { uid: uid },
    };

    const payment = await pi.createPayment(paymentData, username);
    payments[payment.identifier] = payment;
    res.json(payment);
  } catch (error) {
    console.error('Lỗi tạo payment:', error);
    res.status(500).json({ error: 'Lỗi khi tạo thanh toán' });
  }
});

// Route approve (Pi gọi sau khi người dùng đồng ý)
router.post('/approve', async (req, res) => {
  const payment = req.body.payment;

  try {
    await pi.approvePayment(payment.identifier);
    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi khi approve:', error);
    res.status(500).json({ error: 'Lỗi approve' });
  }
});

// Route complete (Pi gọi sau khi giao dịch hoàn tất)
router.post('/complete', async (req, res) => {
  const payment = req.body.payment;

  try {
    await pi.completePayment(payment.identifier);
    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi khi complete:', error);
    res.status(500).json({ error: 'Lỗi complete' });
  }
});

module.exports = router;
