import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { approvePayment, completePayment } from './utils/pi-api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

app.get('/', (req, res) => {
  res.send('Pi Payment Backend is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
