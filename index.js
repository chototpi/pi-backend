import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { MongoClient, ObjectId } from "mongodb";

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
.catch(err => console.error("❌ MongoDB lỗi:", err));

const db = mongoose.connection.useDb("chototpi");

// ----- Định nghĩa Schema -----
const postSchema = new mongoose.Schema({
  username: String,
  title: String,
  description: String,
  price: String,
  contact: String,
  images: [String],
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Post = db.model("Post", postSchema);

// ----- Trang chủ -----
app.get("/", (req, res) => {
  res.send("Pi Marketplace backend đang chạy...");
});

// ----- Gửi bài mới -----
app.post("/submit-post", async (req, res) => {
  try {
    const { username, title, description, price, contact, images } = req.body;
    const post = new Post({ username, title, description, price, contact, images });
    await post.save();
    res.json({ success: true, message: "Đã gửi bài, chờ admin duyệt." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----- Lấy bài chưa duyệt (admin) -----
app.get("/admin/posts", async (req, res) => {
  try {
    const posts = await Post.find({ approved: false }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn bài chưa duyệt" });
  }
});

// ----- Duyệt bài theo ID (admin) -----
app.post("/approve/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    await postsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { approved: true } }
    );

    res.json({ message: "Duyệt bài thành công" });
  } catch (err) {
    console.error("Approve Post Error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// ----- Lấy bài đã duyệt (trang chủ) -----
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find({ approved: true }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn bài đã duyệt" });
  }
});

// Từ chối bài (xoá bài chưa duyệt)
app.delete("/reject-post/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await Post.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi từ chối bài" });
  }
});

// Lấy bài đăng chi tiết
app.get("/post/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // Kiểm tra id có đúng chuẩn ObjectId không
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const post = await postsCollection.findOne({ _id: new ObjectId(id) });

    if (!post) {
      return res.status(404).json({ message: "Không tìm thấy bài đăng" });
    }

    res.json(post);
  } catch (error) {
    console.error("Lỗi server khi lấy bài viết:", error);
    res.status(500).json({ message: "Lỗi server" });
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
