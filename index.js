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
  origin: ["https://chototpi.site"], // cho phép domain này gọi API
  methods: ["GET", "POST"],
  credentials: true
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

// ----- Gửi bài mới -----
app.post('/submit-post', async (req, res) => {
  try {
    const { title, description, price, contact, images, menu, adress } = req.body;
    
    // Xử lý username
    let username = "";
    if (typeof req.body.username === "string") {
      username = req.body.username.trim();
    } else if (typeof req.body.username === "object" && req.body.username !== null) {
      // Nếu username là object, chuyển thành chuỗi
      username = req.body.username.username ? String(req.body.username.username).trim() : "";
    }

    if (!title || !description || !price || !contact || !images || !username || !menu || !adress) {
      return res.status(400).json({ message: 'Thiếu dữ liệu bắt buộc.' });
    }

    const post = {
      title,
      description,
      price,
      contact,
      images,
      username,    // Lưu username đã chuẩn hóa dạng chuỗi
      menu,
      adress,
      approved: false,
      createdAt: new Date()
    };

    await db.collection('posts').insertOne(post);
    res.json({ message: 'Đăng bài thành công!' });

  } catch (err) {
    console.error('Lỗi submit bài:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ----- Lấy bài chưa duyệt (admin) -----
app.get('/admin/waiting', async (req, res) => {
  try {
    const posts = await db.collection('posts').find({ approved: false }).toArray();
    res.json(posts);
  } catch (error) {
    console.error('Lỗi tải bài chờ duyệt:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ----- Duyệt bài theo ID (admin) -----
app.post('/admin/approve', async (req, res) => {
  try {
    const { id, title, price, description, contact } = req.body;

    await client.connect();
    const db = client.db("chototpi");
    const posts = db.collection("posts");

    await posts.updateOne(
      { _id: new ObjectId(id) },
      { $set: { approved: true, title, price, description, contact } }
    );
    
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

//Lấy bài đã duyệt hiển thị trang chủ
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find({ approved: true }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn bài đã duyệt" });
  }
});

// ----- Lấy bài đã duyệt về trang quản lý -----
app.get('/admin/approved', async (req, res) => {
  try {
    const posts = await db.collection('posts').find({ approved: true }).toArray();
    res.json(posts);
  } catch (error) {
    console.error('Lỗi tải bài đã duyệt:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Từ chối bài (xoá bài chưa duyệt)
app.delete("/reject-post/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Post.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi từ chối bài" });
  }
});

//Xóa Bài đã duyệt
app.delete("/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await client.connect();
    const db = client.db("chototpi");
    const posts = db.collection("posts");

    await posts.deleteOne({ _id: new ObjectId(id) });

    res.json({ message: "Đã xoá bài thành công" });
  } catch (err) {
    console.error("Lỗi xoá bài:", err);
    res.status(500).json({ message: "Lỗi server" });
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

// API cập nhật bài đăng
app.put('/update-post/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, price, description, contact } = req.body;

    await db.collection('posts').updateOne(
      { _id: new ObjectId(id) },
      { $set: { title, price, description, contact, approved: false } } // Sau sửa thì cần duyệt lại
    );

    res.json({ message: "Cập nhật bài thành công." });
  } catch (error) {
    console.error('Lỗi cập nhật bài đăng:', error);
    res.status(500).json({ message: 'Lỗi server' });
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

// Lấy bài đăng theo username
app.get('/user-posts/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const posts = await db.collection('posts').find({ username: username }).toArray();
    res.json(posts);
  } catch (error) {
    console.error('Lỗi lấy danh sách bài đăng:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

//Cho thành viên xóa bài
app.delete('/delete-post/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });
    res.json({ message: 'Xoá bài thành công' });
  } catch (error) {
    console.error('Lỗi xoá bài:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

//Tính năng lướt vô hạn
app.get("/posts", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  const posts = await db.collection("posts")
    .find({ duyet: 1 })
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  res.json(posts);
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

//Nạp Pi thành công Cập nhật số dư
app.post("/wallet/deposit", async (req, res) => {
  const { username, amount, txid } = req.body;

  if (!username || !amount || !txid) {
    return res.status(400).json({ error: "Thiếu dữ liệu" });
  }

  const wallets = db.collection("wallets");

  try {
    await wallets.updateOne(
      { username },
      {
        $inc: { balance: amount },
        $push: {
          transactions: {
            type: "deposit",
            amount,
            txid,
            createdAt: new Date()
          }
        }
      },
      { upsert: true }
    );

    res.json({ message: "Nạp Pi thành công" });
  } catch (err) {
    console.error("Lỗi nạp Pi:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//Rút Pi (Có kiểm duyệt trước)
app.post("/wallet/withdraw", async (req, res) => {
  const { username, address, amount } = req.body;

  if (!username || !address || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
  }

  const wallets = db.collection("wallets");
  const user = await wallets.findOne({ username });

  if (!user || user.balance < amount) {
    return res.status(400).json({ success: false, message: "Số dư không đủ" });
  }

  await db.collection("withdraw_requests").insertOne({
    username,
    address,
    amount,
    status: "pending",
    created_at: new Date()
  });

  res.json({ success: true, message: "Yêu cầu rút Pi đã được gửi" });
});
//Admin duyệt rút pi
app.post("/wallet/approve-withdraw", async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ success: false, message: "Thiếu ID" });

  const ObjectId = require("mongodb").ObjectId;
  const requests = db.collection("withdraw_requests");
  const wallets = db.collection("wallets");

  const request = await requests.findOne({ _id: new ObjectId(requestId), status: "pending" });
  if (!request) return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu" });

  const user = await wallets.findOne({ username: request.username });
  if (!user || user.balance < request.amount) {
    return res.status(400).json({ success: false, message: "Số dư không đủ" });
  }

  // Gửi Pi bằng hàm thủ công fetch
  const sendResult = await sendPiWithFetch(request.address, request.amount);
  if (!sendResult.success) {
    return res.status(500).json({ success: false, message: "Gửi Pi thất bại" });
  }

  // Trừ số dư và cập nhật trạng thái
  await wallets.updateOne({ username: request.username }, { $inc: { balance: -request.amount } });
  await requests.updateOne(
    { _id: request._id },
    { $set: { status: "approved", txid: sendResult.txid, approved_at: new Date() } }
  );

  res.json({ success: true, message: "Đã gửi Pi", txid: sendResult.txid });
});

// API GET: Lấy số dư người dùng (theo định dạng yêu cầu)
app.get("/api/balance", async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ success: false, message: "Thiếu username" });
  }

  try {
    const wallets = db.collection("wallets");
    const user = await wallets.findOne({ username });

    const balance = user?.balance || 0;
    res.json({ success: true, balance });
  } catch (err) {
    console.error("Lỗi lấy số dư:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// API: Lấy tất cả yêu cầu rút Pi có trạng thái pending
app.get("/api/withdraw-logs", async (req, res) => {
  try {
    const logs = await db.collection("withdraw_requests")
      .find({ status: "pending" })
      .sort({ created_at: -1 })
      .toArray();

    res.json({ success: true, logs });
  } catch (err) {
    console.error("Lỗi khi lấy withdraw logs:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách rút Pi" });
  }
});

// Admin xác nhận đã chuyển Pi
app.post("/api/withdraw-confirm", async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: "Thiếu ID" });

  const logs = db.collection("wallet_requests");
  try {
    await logs.updateOne({ _id: new ObjectId(id) }, { $set: { confirmed: true } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi xác nhận" });
  }
});

// Route gửi Pi từ ví admin đến người dùng
app.post("/wallet/send", async (req, res) => {
  const { username, amount } = req.body;

  if (!username || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
  }

  try {
    const wallets = db.collection("wallets");
    const user = await wallets.findOne({ username });

    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // 🧠: Ở đây bạn sẽ thực hiện gửi Pi thật nếu muốn
    // Ví dụ gọi hàm giả lập:
    const result = await sendPiToUser(username, amount); // Hàm này bạn cần định nghĩa

    if (result.success) {
      return res.json({ success: true });
    } else {
      return res.status(500).json({ success: false, message: "Gửi Pi thất bại" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Hàm gửi Pi thật bằng Pi SDK
async function sendPiToUser(username, amount) {
  try {
    const wallets = db.collection("wallets");
    const user = await wallets.findOne({ username });

    if (!user || !user.wallet_address) {
      return { success: false, message: "Không tìm thấy địa chỉ ví người dùng" };
    }

    const result = await pi.wallet.sendPayment({
      to: user.wallet_address,
      amount: amount.toString(),
      memo: `Withdraw Pi by ${username}`
    });

    if (result && result.txid) {
      console.log("Đã gửi Pi thành công:", result.txid);
      return { success: true, txid: result.txid };
    } else {
      return { success: false, message: "Không có txid trả về" };
    }

  } catch (err) {
    console.error("Lỗi khi gửi Pi:", err);
    return { success: false, message: "Lỗi khi gửi Pi" };
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
