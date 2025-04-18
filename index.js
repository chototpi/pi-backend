const express = require('express');
const cors = require('cors'); // Bổ sung dòng này

const app = express();

// Bật CORS để cho phép frontend gọi API
app.use(cors());

// Cho phép đọc dữ liệu JSON từ request
app.use(express.json());

// Import các route
const testRoutes = require('./routes/test');
const paymentRoutes = require('./routes/payment');

// Sử dụng route
app.use('/api/test', testRoutes);
app.use('/api/payment', paymentRoutes);

// Khởi chạy server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
