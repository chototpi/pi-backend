
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

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Đã kết nối MongoDB"))
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
    const post = new Post({ username, title, description });
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

// ----- PI PAYMENT ROUTES -----
const API_KEY = process.env.PI_API_KEY;

app.post("/approve-payment", async (req, res) => {
  const { paymentId } = req.body;
  try {
    const result = await fetch(`https://api.minepi.com/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const json = await result.json();
    res.json(json);
  } catch (err) {
    console.error("Approve catch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/complete-payment", async (req, res) => {
  const { paymentId, txid } = req.body;
  try {
    const result = await fetch(`https://api.minepi.com/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    });
    const json = await result.json();
    res.json(json);
  } catch (err) {
    console.error("Complete catch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------

app.listen(PORT, () => {
  console.log(`✅ Server chạy tại http://localhost:${PORT}`);
});
