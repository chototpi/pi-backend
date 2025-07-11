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
  origin: "https://payofpi.click"
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
        Authorization: `Key ${process.env.PI_API_MAINNET}`,
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
        Authorization: `Key ${process.env.PI_API_MAINNET}`,
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

app.get("/pinet/meta", (req, res) => {
  const pathname = req.query.pathname || "/";

  // Tùy biến theo đường dẫn nếu bạn có nhiều page
  let metadata = {
    title: "Pay Of Pi - Cổng thanh toán Pi",
    description: "Thanh toán hoá đơn và nạp tiền bằng Pi Network tại Việt Nam.",
    image: "https://payofpi7677.pinet.com/paylogo.png", // ảnh cần đúng URL truy cập được công khai
    url: "https://payofpi7677.pinet.com" + pathname,
  };

  // Trả về DTO chuẩn cho PiNet
  res.status(200).json({
    title: metadata.title,
    description: metadata.description,
    image: metadata.image,
    url: metadata.url,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
