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
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: "Thiếu ID" });
  }

  try {
    const request = await db.collection("withdraw_requests").findOne({ _id: new ObjectId(id) });

    if (!request || request.status !== "pending") {
      return res.status(400).json({ success: false, message: "Yêu cầu không tồn tại hoặc đã xử lý" });
    }

    // Gửi Pi thật
    const result = await sendPiWithFetch(request.address, request.amount);

    if (result.success) {
      // Cập nhật trạng thái
      await db.collection("withdraw_requests").updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "approved", txid: result.txid, approved_at: new Date() } }
      );

      // Trừ số dư
      await db.collection("wallets").updateOne(
        { username: request.username },
        { $inc: { balance: -request.amount } }
      );

      return res.json({ success: true, txid: result.txid });
    } else {
      return res.status(500).json({ success: false, message: "Chuyển Pi thất bại", error: result.error });
    }
  } catch (err) {
    console.error("Lỗi khi duyệt rút Pi:", err);
    return res.status(500).json({ success: false, message: "Lỗi server", error: err.message });
  }
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

// Hàm gửi Pi
async function sendPiWithFetch(toAddress, amount) {
  const apiKey = process.env.WALLET_KEY;
  const fromAddress = "GC4WRGL4VF75GXU7XIZKKPY3NLVDRU7SL5A5U3F2C5O33T4YGTW3SR4Q"; // địa chỉ ví App

  try {
    const res = await fetch("https://api.minepi.com/v2/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sender_uid: "your_app_uid",
        recipient_address: toAddress,
        amount: amount,
        memo: "Withdraw from App",
        metadata: {}
      })
    });

    const data = await res.json();
    if (data.txid) {
      return { success: true, txid: data.txid };
    } else {
      return { success: false, error: data };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
