import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Pi Payment Backend is running');
});

// Approve payment
app.post("/approve-payment", async (req, res) => {
  const { paymentId } = req.body;
  console.log("Approve:", paymentId);

  if (!paymentId) {
    return res.status(400).json({ error: "Missing paymentId" });
  }

  try {
    const response = await fetch(`https://api.minepi.com/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.PI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})  // <-- Phải có body (kể cả rỗng)
    });

    const text = await response.text();
    console.log("Raw response:", text);

    if (!response.ok) {
      console.error("Approve failed:", text);
      return res.status(500).json({ error: text });
    }

    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    console.error("Approve catch error:", err);
    res.status(500).json({ error: "Server error (approve)" });
  }
});

// Complete payment
app.post('/complete-payment', async (req, res) => {
  const { paymentId } = req.body;
  console.log("Complete-payment:", paymentId);

  if (!paymentId) {
    console.error("Missing paymentId");
    return res.status(400).json({ error: "Missing paymentId" });
  }

  try {
    const response = await fetch(`https://api.minepi.com/payments/${paymentId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.PI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    console.log("Raw response from Pi API:", text);
    const result = await response.json();
    console.log("Pi API complete response:", result);

    if (!response.ok) {
      console.error("Complete failed:", result);
      return res.status(500).json({ error: result });
    }

    res.json(result);
  } catch (error) {
    console.error("Complete catch error:", error);
    res.status(500).json({ error: "Server error (complete)" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
