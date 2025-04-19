const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
  const { amount, memo, uid } = req.body;

  if (!amount || !memo || !uid) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
  }

  // Tạm thời giả lập việc xử lý thanh toán
  res.json({
    success: true,
    message: 'Thanh toán đã nhận!',
    data: { amount, memo, uid }
  });
});

module.exports = router;
