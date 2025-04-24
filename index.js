import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

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

// ----- Route đăng nhập Pi giữ nguyên phần bạn đang dùng -----
app.get("/", (req, res) => {
  res.send("Chợ Tốt Pi Backend đang chạy...");
});

// ----- MARKET FUNCTIONALITY GỘP VÀO ĐÂY -----
const postSchema = new mongoose.Schema({
  username: String,
  title: String,
  description: String,
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model("Post", postSchema);

// Gửi bài viết
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

// Lấy danh sách bài đã duyệt
app.get("/market/approved", async (req, res) => {
  const posts = await Post.find({ approved: true }).sort({ createdAt: -1 });
  res.json(posts);
});

// Lấy tất cả bài (cho admin)
app.get("/market/all", async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

// Duyệt bài (admin)
app.post("/market/approve/:id", async (req, res) => {
  try {
    await Post.findByIdAndUpdate(req.params.id, { approved: true });
    res.json({ success: true, message: "Bài đã được duyệt." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------

app.listen(PORT, () => {
  console.log(`✅ Server chạy tại http://localhost:${PORT}`);
});
