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
  origin: "https://chototpi.site"
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
app.post("/admin/approve", async (req, res) => {
  try {
    const { id } = req.body;

    // Kiểm tra id có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    // Cập nhật trạng thái bài đăng thành "approved" bằng Mongoose
    const result = await Post.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { approved: true } });

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Không tìm thấy bài đăng để duyệt" });
    }

    res.json({ message: "Đã duyệt bài thành công" });
  } catch (err) {
    console.error("Lỗi duyệt bài:", err);
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

    const post = await Post.findById(id); // Sử dụng Post.findById

    if (!post) {
      return res.status(404).json({ message: "Không tìm thấy bài đăng" });
    }

    res.json(post);
  } catch (error) {
    console.error("Lỗi server khi lấy bài viết:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Route thêm bình luận
app.post('/post/:id/comment', async (req, res) => {
  try {
    const postId = req.params.id;
    const { username, content } = req.body;

    if (!username || !content) {
      return res.status(400).json({ message: 'Thiếu username hoặc nội dung.' });
    }

    await client.connect();
    const db = client.db("chototpi");
    const posts = db.collection("posts");

    const comment = {
      username,
      content,
      createdAt: new Date()
    };

    await posts.updateOne(
      { _id: new ObjectId(postId) },
      { $push: { comments: comment } }
    );

    res.json({ message: 'Đã thêm bình luận' });
  } catch (error) {
    console.error('Lỗi thêm bình luận:', error);
    res.status(500).json({ message: 'Lỗi server' });
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
