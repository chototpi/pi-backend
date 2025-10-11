import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
// Xóa import ObjectId vì không cần thiết nếu dùng Mongoose cho route /post/:id
import { MongoClient, ObjectId } from "mongodb"; // Comment hoặc xóa dòng này

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "https://testnet.chototpi.site"
}));
app.use(express.json());
// Xóa client vì không sử dụng MongoDB native driver trong route /post/:id
const client = new MongoClient(process.env.MONGODB_URI, {});

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Đã kết nối MongoDB"))
.catch(err => console.error("❌ MongoDB lỗi:", err));

const db = mongoose.connection.useDb("chototpi");

// ----- Định nghĩa Schema -----
const postSchema = new mongoose.Schema({
  username: String,
  title: String,
  menu: String,
  description: String,
  price: String,
  contact: String,
  adress: String,
  images: [String],
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Post = db.model("Post", postSchema);

// ----- Trang chủ -----
app.get("/", (req, res) => {
  res.send("Pi Marketplace backend đang chạy...");
});

// APPROVE PAYMENT
app.post("/approve-payment", async (req, res) => {
  const { paymentId } = req.body;
  console.log("Approve request for:", paymentId);

  if (!paymentId) {
    return res.status(400).json({ error: "Missing paymentId" });
  }

  try {
    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.PI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})  // NEW body each time
    });

    const text = await response.text();
    console.log("Approve raw response:", text);

    if (!response.ok) {
      console.error("Approve failed:", text);
      return res.status(500).json({ error: text });
    }

    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    console.error("Approve ERROR:", err);
    res.status(500).json({ error: "Server error (approve)" });
  }
});

// COMPLETE PAYMENT
app.post("/complete-payment", async (req, res) => {
  const { paymentId, txid } = req.body;
  console.log("Complete request:", paymentId, txid);

  if (!paymentId || !txid) {
    return res.status(400).json({ error: "Missing paymentId or txid" });
  }

  try {
    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.PI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ txid }) // <-- Thêm txid vào body
    });

    const text = await response.text();
    console.log("Complete raw response:", text);

    if (!response.ok) {
      console.error("Complete failed:", text);
      return res.status(500).json({ error: text });
    }

    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    console.error("Complete ERROR:", err);
    res.status(500).json({ error: "Server error (complete)" });
  }
});

// --- APPROVE PAYMENT ---
app.post("/api/approve-payment", async (req, res) => {
  const { paymentId } = req.body;
  if (!paymentId) return res.status(400).json({ error: "Missing paymentId" });

  try {
    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.PI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    const text = await response.text();
    if (!response.ok) return res.status(500).json({ error: text });

    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    console.error("Approve ERROR:", err);
    res.status(500).json({ error: "Server error (approve)" });
  }
});

// --- COMPLETE PAYMENT ---
app.post("/api/complete-payment", async (req, res) => {
  const { paymentId, txid } = req.body;
  if (!paymentId || !txid) return res.status(400).json({ error: "Missing paymentId or txid" });

  try {
    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.PI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ txid })
    });

    const text = await response.text();
    if (!response.ok) return res.status(500).json({ error: text });

    const result = JSON.parse(text);
    const meta = result.metadata || {};
    const uid = meta.uid || null;
    const username = meta.username || "unknown";
    const wallet_address = meta.wallet_address || null;
    const amount = parseFloat(result.amount || 0);

    if (!uid) return res.status(400).json({ error: "UID not found in metadata" });

    // Lưu hoặc cập nhật user
    const user = await PiUser.findOneAndUpdate(
      { uid },
      {
        username,
        wallet_address,
        $inc: { balance: amount },
        txid,
        paymentId,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, uid, username, wallet_address, amount, txid, paymentId });
  } catch (err) {
    console.error("Complete ERROR:", err);
    res.status(500).json({ error: "Server error (complete)" });
  }
});

// --- KIỂM TRA SỐ DƯ ---
app.get("/api/balance/:uid", async (req, res) => {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  try {
    const user = await PiUser.findOne({ uid });
    if (!user) return res.json({ success: false, message: "User not found" });

    res.json({ success: true, uid, username: user.username, balance: user.balance });
  } catch (err) {
    console.error("Balance ERROR:", err);
    res.status(500).json({ error: "Server error (balance)" });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
