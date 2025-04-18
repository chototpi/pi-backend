const express = require('express');
const router = express.Router();

// Route demo xử lý thanh toán
router.post('/', async (req, res) => {
  try {
    const { amount, memo, uid } = req.body;

    // Giả lập xử lý thanh toán ở đây (sẽ thay bằng Pi SDK thực tế)
    console.log(`Nhận yêu cầu thanh toán: ${amount} Pi từ ${uid} - memo: ${memo}`);

    // Trả về phản hồi demo
    res.json({
      success: true,
      message: 'Yêu cầu thanh toán Pi đã được nhận.',
      data: { amount, memo, uid }
    });
  } catch (err) {
    console.error('Lỗi xử lý thanh toán:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
  }
});

module.exports = router;
