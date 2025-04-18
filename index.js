require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const testRoute = require('./routes/test');
app.use('/api/test', testRoute);

app.use(express.json());

const PORT = process.env.PORT || 3000;
const PI_API_KEY = process.env.PI_API_KEY;

app.post('/confirm-payment', async (req, res) => {
  const { paymentId, txid } = req.body;

  if (!paymentId || !txid) {
    return res.status(400).json({ error: 'Thiếu paymentId hoặc txid' });
  }

  try {
    const response = await axios.post(
      `https://api.minepi.com/payments/${paymentId}/complete`,
      { txid },
      {
        headers: {
          Authorization: `Bearer ${PI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      message: 'Thanh toán thành công!',
      pi_response: response.data
    });
  } catch (error) {
    console.error('Lỗi xác nhận:', error.response?.data || error.message);
    res.status(500).json({ error: 'Xác nhận thất bại', detail: error.response?.data || error.message });
  }
});

app.get("/", (_, res) => {
  res.send("Pi backend hoạt động!");
});

app.listen(PORT, () => {
  console.log(`Pi backend đang chạy tại cổng ${PORT}`);
});
