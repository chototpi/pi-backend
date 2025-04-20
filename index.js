import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { approvePayment, completePayment } from './utils/pi-api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const fetch = require('node-fetch'); 

app.use(cors());
app.use(express.json());

app.post('/approve-payment', async (req, res) => {
  const { paymentId } = req.body;

  if (!paymentId) {
    return res.status(400).json({ error: 'Missing paymentId' });
  }

  try {
    const approved = await approvePayment(paymentId);
    const completed = await completePayment(paymentId);
    res.json({ success: true, approved, completed });
  } catch (error) {
    console.error('Error processing payment:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/complete-payment', async (req, res) => {
  try {
    const paymentId = req.body.paymentId;

    // Gọi API Pi để hoàn tất thanh toán
    const response = await fetch(`https://api.minepi.com/payments/${paymentId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.PI_API_SECRET}`, // lấy từ .env
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pi API Error:', errorText);
      return res.status(500).json({ error: 'Failed to complete payment' });
    }

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('Complete payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/', (req, res) => {
  res.send('Pi Payment Backend is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
