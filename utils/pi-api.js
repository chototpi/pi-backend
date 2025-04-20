import axios from 'axios';

const API_KEY = process.env.PI_API_KEY;
const BASE_URL = 'https://api.minepi.com/v2/payments';

const headers = {
  Authorization: `Key ${API_KEY}`,
  'Content-Type': 'application/json',
};

export async function approvePayment(paymentId) {
  const url = `${BASE_URL}/${paymentId}/approve`;
  const res = await axios.post(url, {}, { headers });
  return res.data;
}

export async function completePayment(paymentId) {
  const url = `${BASE_URL}/${paymentId}/complete`;
  const res = await axios.post(url, {}, { headers });
  return res.data;
}
