import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
// Xóa import ObjectId vì không cần thiết nếu dùng Mongoose cho route /post/:id
import { MongoClient, ObjectId } from "mongodb"; // Comment hoặc xóa dòng này
import StellarSdk from "@stellar/stellar-sdk";

const stellarServer = new StellarSdk.Server("https://api.testnet.minepi.com");
const APP_SECRET_KEY = process.env.WALLET_SECRET_KEY;
const APP_PUBLIC_KEY = StellarSdk.Keypair.fromSecret(APP_SECRET_KEY).publicKey();

const Networks = StellarSdk.Networks;
const Keypair = StellarSdk.Keypair;
const Asset = StellarSdk.Asset;
const Operation = StellarSdk.Operation;
const TransactionBuilder = StellarSdk.TransactionBuilder;

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ["https://chototpi.site"], // cho phép domain này gọi API
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(bodyParser.json());
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

    const { address, amount, username } = request;

    const created = await initiateA2UPayment(address, amount, "Rút Pi");
    if (!created.success) {
      return res.status(500).json({ success: false, message: "Lỗi tạo A2U", error: created.error });
    }

    const submitted = await signAndSubmitA2UTransaction(created.paymentId, created.recipient, amount);
    if (!submitted.success) {
      return res.status(500).json({ success: false, message: "Lỗi gửi giao dịch", error: submitted.error });
    }

    await db.collection("withdraw_requests").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "approved", txid: submitted.txid, approved_at: new Date() } }
    );

    await db.collection("wallets").updateOne(
      { username },
      { $inc: { balance: -amount } }
    );

    return res.json({ success: true, txid: submitted.txid });
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

// --- HÀM TẠO GIAO DỊCH A2U ---
async function initiateA2UPayment(toAddress, amount, memo = "") {
  try {
    const res = await axios.post(
      "https://api.minepi.com/v2/payments",
      {
        amount: amount.toString(),
        memo,
        metadata: { purpose: "A2U payout" },
        to_address: toAddress,
      },
      {
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      paymentId: res.data.identifier,
      recipient: res.data.recipient,
    };
  } catch (err) {
    console.error("❌ Tạo A2U thất bại:", err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// --- HÀM KÝ VÀ GỬI GIAO DỊCH ---
async function signAndSubmitA2UTransaction(paymentId, recipientAddress, amount) {
  try {
    const sourceKeypair = Keypair.fromSecret(APP_SECRET_KEY);
    const account = await stellarServer.loadAccount(APP_PUBLIC_KEY);
    const fee = await stellarServer.fetchBaseFee();

    const tx = new TransactionBuilder(account, {
      fee,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: recipientAddress,
          asset: Asset.native(),
          amount: amount.toString(),
        })
      )
      .setTimeout(60)
      .build();

    tx.sign(sourceKeypair);
    const result = await stellarServer.submitTransaction(tx);

    console.log("✅ Gửi Pi thành công:", result.hash);
    return { success: true, txid: result.hash };
  } catch (err) {
    console.error("❌ Gửi Pi lỗi:", err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
