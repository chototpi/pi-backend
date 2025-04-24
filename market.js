import express from "express";
import mongoose from "mongoose";

const router = express.Router();

const uri = process.env.MONGO_URI;
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const postSchema = new mongoose.Schema({
  username: String,
  title: String,
  description: String,
  approved: { type: Boolean, default: false },
});

const Post = mongoose.model("Post", postSchema);

// Gửi bài viết mới
router.post("/submit", async (req, res) => {
  const { username, title, description } = req.body;
  const post = new Post({ username, title, description });
  await post.save();
  res.json({ message: "Đã gửi bài chờ duyệt." });
});

// Admin duyệt bài
router.post("/approve/:id", async (req, res) => {
  await Post.findByIdAndUpdate(req.params.id, { approved: true });
  res.json({ message: "Đã duyệt bài." });
});

// Lấy danh sách bài đã duyệt
router.get("/approved", async (req, res) => {
  const posts = await Post.find({ approved: true });
  res.json(posts);
});

export default router;
