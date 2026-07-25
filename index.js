import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const PI_API_BASE = "https://api.minepi.com/v2";
const PI_NETWORK_API_KEY = process.env.PI_NETWORK_API_KEY;


// =====================================================
// CORS
// =====================================================

const allowedOrigins = [
  "https://mobile-world-orpin.vercel.app",
  "https://payofpi.click",
  "https://vn.payofpi.click",
  "https://chototpi.site",
  "https://testnet.chototpi.site",
  "https://payofpi2196.pinet.com",
  "https://thgiith7068.pinet.com",
];

app.use(
  cors({
    origin(origin, callback) {

      console.log("🌐 Origin:", origin);

      // curl / Postman / server-to-server
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Pi App Studio preview
      if (origin.endsWith(".vusercontent.net")) {
        console.log(
          "✅ Allowed vusercontent:",
          origin
        );

        return callback(null, true);
      }

      console.log(
        "❌ CORS blocked:",
        origin
      );

      return callback(
        new Error(
          `CORS blocked for: ${origin}`
        )
      );
    },

    credentials: true,
  })
);

app.use(express.json());


// =====================================================
// CHECK PI API KEY
// =====================================================

if (!PI_NETWORK_API_KEY) {
  console.error(
    "❌ PI_NETWORK_API_KEY is missing"
  );
}


// =====================================================
// PI API HELPER
// =====================================================

async function piRequest(
  path,
  options = {}
) {

  if (!PI_NETWORK_API_KEY) {
    throw new Error(
      "PI_NETWORK_API_KEY is not configured"
    );
  }

  const response = await fetch(
    `${PI_API_BASE}${path}`,
    {
      ...options,

      headers: {
        Authorization:
          `Key ${PI_NETWORK_API_KEY}`,

        "Content-Type":
          "application/json",

        ...(options.headers || {}),
      },
    }
  );

  const text =
    await response.text();

  let data = null;

  if (text) {
    try {

      data =
        JSON.parse(text);

    } catch {

      data = {
        raw: text,
      };

    }
  }

  if (!response.ok) {

    const error =
      new Error(
        `Pi API returned ${response.status}`
      );

    error.status =
      response.status;

    error.piResponse =
      data;

    throw error;
  }

  return data;
}


// =====================================================
// GET PAYMENT FROM PI
// =====================================================

async function getPiPayment(
  paymentId
) {

  return piRequest(
    `/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
    }
  );
}


// =====================================================
// HEALTH
// =====================================================

app.get(
  "/health",
  (req, res) => {

    res.json({
      success: true,
      service:
        "Mobile World Pi Payment Backend",

      piApiKeyConfigured:
        Boolean(
          PI_NETWORK_API_KEY
        ),
    });
  }
);


// =====================================================
// GET PAYMENT
//
// Debug/status endpoint.
// Data comes directly from Pi.
// =====================================================

app.get(
  "/pi/payments/:paymentId",
  async (req, res) => {

    try {

      const {
        paymentId
      } = req.params;

      if (!paymentId) {

        return res.status(400).json({
          success: false,
          error: "Missing paymentId",
        });

      }

      const payment =
        await getPiPayment(
          paymentId
        );

      return res.json({
        success: true,
        payment,
      });

    } catch (err) {

      console.error(
        "❌ GET PAYMENT ERROR:",
        err
      );

      return res
        .status(
          err.status || 500
        )
        .json({
          success: false,

          error:
            err.message ||
            "Unable to get payment",

          piResponse:
            err.piResponse ||
            null,
        });
    }
  }
);


// =====================================================
// APPROVE PAYMENT
//
// Called from:
// onReadyForServerApproval(paymentId)
// =====================================================

app.post(
  "/pi/payments/:paymentId/approve",
  async (req, res) => {

    const {
      paymentId
    } = req.params;

    try {

      console.log(
        "🟡 APPROVE:",
        paymentId
      );

      if (!paymentId) {

        return res.status(400).json({
          success: false,
          error: "Missing paymentId",
        });

      }


      // ===============================================
      // 1. Get payment from Pi
      // ===============================================

      const payment =
        await getPiPayment(
          paymentId
        );

      console.log(
        "📦 PAYMENT:",
        payment
      );


      // ===============================================
      // 2. Basic validation
      // ===============================================

      const amount =
        Number(
          payment?.amount
        );

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Invalid payment amount",
        });

      }


      /*
       * IMPORTANT
       *
       * Đây là vị trí chúng ta sẽ thêm:
       *
       * productId -> DB/API sản phẩm
       *             -> expected price
       *             -> compare payment.amount
       *
       * Không dùng metadata từ frontend
       * làm nguồn xác định giá.
       */


      // ===============================================
      // 3. Approve payment
      // ===============================================

      const approved =
        await piRequest(
          `/payments/${encodeURIComponent(
            paymentId
          )}/approve`,
          {
            method: "POST",
            body: JSON.stringify({}),
          }
        );


      console.log(
        "✅ APPROVED:",
        paymentId
      );


      return res.json({
        success: true,
        paymentId,
        payment: approved,
      });

    } catch (err) {

      console.error(
        "❌ APPROVE ERROR:",
        err
      );


      return res
        .status(
          err.status || 500
        )
        .json({
          success: false,

          error:
            err.message ||
            "Approve failed",

          piResponse:
            err.piResponse ||
            null,
        });
    }
  }
);


// =====================================================
// COMPLETE PAYMENT
//
// Called from:
// onReadyForServerCompletion(paymentId, txid)
// =====================================================

app.post(
  "/pi/payments/:paymentId/complete",
  async (req, res) => {

    const {
      paymentId
    } = req.params;

    const {
      txid
    } = req.body;


    try {

      console.log(
        "🟢 COMPLETE:",
        paymentId
      );

      console.log(
        "🔗 TXID:",
        txid
      );


      if (
        !paymentId ||
        !txid
      ) {

        return res.status(400).json({
          success: false,

          error:
            "Missing paymentId or txid",
        });

      }


      // ===============================================
      // 1. Get payment before completion
      // ===============================================

      const paymentBefore =
        await getPiPayment(
          paymentId
        );


      console.log(
        "📦 BEFORE COMPLETE:",
        paymentBefore
      );


      const amount =
        Number(
          paymentBefore?.amount
        );


      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        return res.status(400).json({
          success: false,

          error:
            "Invalid payment amount",
        });

      }


      /*
       * Sau này validate order/product ở đây
       * lần thứ hai trước khi complete.
       */


      // ===============================================
      // 2. Complete payment
      // ===============================================

      const completed =
        await piRequest(
          `/payments/${encodeURIComponent(
            paymentId
          )}/complete`,
          {
            method: "POST",

            body:
              JSON.stringify({
                txid,
              }),
          }
        );


      // ===============================================
      // 3. Fetch authoritative final state
      // ===============================================

      const verified =
        await getPiPayment(
          paymentId
        );


      console.log(
        "💰 VERIFIED PAYMENT:",
        verified
      );


      return res.json({
        success: true,

        paymentId,
        txid,

        payment:
          verified ||
          completed,
      });

    } catch (err) {

      console.error(
        "❌ COMPLETE ERROR:",
        err
      );


      return res
        .status(
          err.status || 500
        )
        .json({
          success: false,

          error:
            err.message ||
            "Complete failed",

          piResponse:
            err.piResponse ||
            null,
        });
    }
  }
);


// =====================================================
// INCOMPLETE PAYMENT
//
// Called by:
// onIncompletePaymentFound(payment)
//
// Đây không phải endpoint để frontend tuyên bố
// payment thành công.
//
// Backend hỏi Pi về trạng thái payment.
// Nếu SDK cung cấp txid thì mới gọi complete.
// =====================================================

app.post(
  "/pi/payments/incomplete",
  async (req, res) => {

    const {
      paymentId,
      txid,
    } = req.body;


    try {

      console.log(
        "🟠 INCOMPLETE:",
        paymentId
      );


      if (!paymentId) {

        return res.status(400).json({
          success: false,
          error: "Missing paymentId",
        });

      }


      // ===============================================
      // 1. Get payment state from Pi
      // ===============================================

      const payment =
        await getPiPayment(
          paymentId
        );


      console.log(
        "📦 PAYMENT STATE:",
        payment
      );


      // ===============================================
      // 2. No txid
      //
      // Cannot invent completion.
      // Return authoritative Pi state.
      // ===============================================

      if (!txid) {

        return res.json({
          success: true,

          action:
            "pending",

          payment,
        });

      }


      // ===============================================
      // 3. Complete existing transaction
      // ===============================================

      const completed =
        await piRequest(
          `/payments/${encodeURIComponent(
            paymentId
          )}/complete`,
          {
            method: "POST",

            body:
              JSON.stringify({
                txid,
              }),
          }
        );


      // ===============================================
      // 4. Verify final state
      // ===============================================

      const verified =
        await getPiPayment(
          paymentId
        );


      console.log(
        "✅ INCOMPLETE RESOLVED:",
        paymentId
      );


      return res.json({
        success: true,

        action:
          "completed",

        payment:
          verified ||
          completed,
      });

    } catch (err) {

      console.error(
        "❌ INCOMPLETE ERROR:",
        err
      );


      return res
        .status(
          err.status || 500
        )
        .json({
          success: false,

          error:
            err.message ||
            "Incomplete payment handling failed",

          piResponse:
            err.piResponse ||
            null,
        });
    }
  }
);


// =====================================================
// EXPRESS ERROR HANDLER
// =====================================================

app.use(
  (err, req, res, next) => {

    console.error(
      "❌ EXPRESS ERROR:",
      err
    );


    if (
      err.message?.startsWith(
        "CORS blocked"
      )
    ) {

      return res.status(403).json({
        success: false,
        error: err.message,
      });

    }


    return res.status(500).json({
      success: false,
      error:
        "Internal server error",
    });
  }
);


// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {

    console.log(
      `🚀 Mobile World Pi backend running on port ${PORT}`
    );

  }
);