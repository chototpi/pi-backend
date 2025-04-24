// market.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const postSchema = new mongoose.Schema({
  username: String,
  title: String,
  description: String,
  price: Number,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// Tạo bài đăng
router.post("/posts", async (req, res) => {
  try {
    const { username, title, description, price } = req.body;
    const post = new Post({ username, title, description, price });
    await post.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duyệt bài
router.post("/posts/approve/:id", async (req, res) => {
  await Post.findByIdAndUpdate(req.params.id, { status: 'approved' });
  res.json({ success: true });
});

// Lấy bài chờ duyệt
router.get("/posts/pending", async (req, res) => {
  const posts = await Post.find({ status: 'pending' });
  res.json(posts);
});

// Lấy bài đã duyệt
router.get("/posts/approved", async (req, res) => {
  const posts = await Post.find({ status: 'approved' });
  res.json(posts);
});

module.exports = router;
