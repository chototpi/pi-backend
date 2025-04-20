import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Route test
app.get("/", (req, res) => {
  res.send("Pi Payment Backend is running");
});

// Route approve-payment
app.post("/approve-payment", async (req, res) => {
  const { paymentId } = req.body;
  console.log("Approve request:", paymentId);

  try {
    const response = await fetch(`https://api.minepi.com/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.PI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Approve failed:", result);
      return res.status(500).json({ error: result });
    }

    res.json(result);
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route complete-payment
app.post("/complete-payment", async (req, res) => {
  const { paymentId } = req.body;
  console.log("Complete request:", paymentId);

  try {
    const response = await fetch(`https://api.minepi.com/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.PI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Complete failed:", result);
      return res.status(500).json({ error: result });
    }

    res.json(result);
  } catch (err) {
    console.error("Complete error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
