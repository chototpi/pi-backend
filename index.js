import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Kết nối MongoDB và chọn database 'chototpi'
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ Đã kết nối MongoDB");

  // Chọn đúng database 'chototpi' để thao tác
  const db = mongoose.connection.useDb("chototpi");
})
.catch((err) => console.error("❌ MongoDB lỗi:", err));

// Route kiểm tra server
app.get("/", (req, res) => {
  res.send("Chợ Tốt Pi Backend đang chạy...");
});

// ----- MODEL BÀI ĐĂNG -----
const postSchema = new mongoose.Schema({
  username: String,
  title: String,
  description: String,
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model("Post", postSchema);

// ----- API ĐĂNG BÀI -----
app.post("/market/submit", async (req, res) => {
  try {
    const { username, title, description } = req.body;
    const post = new Post({ username, title, menu, description, price, contract, adress, files });
    await post.save();
    res.json({ success: true, message: "Đã gửi bài, chờ admin duyệt." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/market/approved", async (req, res) => {
  const posts = await Post.find({ approved: true }).sort({ createdAt: -1 });
  res.json(posts);
});

app.get("/market/all", async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

app.post("/market/approve/:id", async (req, res) => {
  try {
    await Post.findByIdAndUpdate(req.params.id, { approved: true });
    res.json({ success: true, message: "Bài đã được duyệt." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
