import axios from 'axios';

const testPayment = async () => {
  try {
    console.log('Testing Razorpay payment creation...');
    
    const response = await axios.post('http://localhost:8080/api/v1/payments/create', {
      amount: 10000, // 100 rupees in paise
      currency: 'INR'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Payment order created successfully:');
    console.log('Order ID:', response.data.data.id);
    console.log('Amount:', response.data.data.amount);
    console.log('Currency:', response.data.data.currency);
    
  } catch (error) {
    console.error('❌ Payment test failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data);
  }
};

testPayment();
