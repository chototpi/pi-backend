// routes/test.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.send('Test route OK');
});

module.exports = router;
