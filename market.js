const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Kết nối MongoDB
mongoose.connect("mongodb+srv://binh06d1:YOUR_PASSWORD@thaibinhpi.fih0lks.mongodb.net/marketplace", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Định nghĩa schema bài đăng
const postSchema = new mongoose.Schema({
  username: String,
  title: String,
  description: String,
  price: Number,
  image: String,
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model("Post", postSchema);

// API: Gửi bài đăng (user)
app.post("/posts", async (req, res) => {
  const { username, title, description, price, image } = req.body;
  const post = new Post({ username, title, description, price, image });
  await post.save();
  res.json({ success: true, message: "Bài đăng đã được gửi, chờ duyệt." });
});

// API: Lấy bài đã duyệt (trang chủ)
app.get("/posts", async (req, res) => {
  const posts = await Post.find({ approved: true }).sort({ createdAt: -1 });
  res.json(posts);
});

// API: Lấy tất cả bài (admin)
app.get("/admin/posts", async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

// API: Duyệt bài đăng (admin)
app.post("/admin/approve", async (req, res) => {
  const { postId } = req.body;
  await Post.findByIdAndUpdate(postId, { approved: true });
  res.json({ success: true, message: "Bài đăng đã được duyệt." });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Market server is running on port ${PORT}`);
});
