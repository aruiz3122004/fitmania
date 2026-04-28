const fetch = require('node-fetch');

async function simulatePayment() {
  const url = 'http://localhost:3000/api/stripe/create-payment';
  const body = {
    amount: 202600, // Enviamos el monto como fallback
    items: [
      { id: 'creatina', cantidad: 1 },
      { id: 'tostadas', cantidad: 1 }
    ],
    customerEmail: 'test@example.com',
    customerName: 'Test User',
    uid: 'test-uid'
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    console.log('Resultado del API:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error en la simulación:', error.message);
  }
}

simulatePayment();
