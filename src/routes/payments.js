const express = require('express')
const router = express.Router()
const axios = require('axios')

const PAYMOB_API_KEY = 'ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SmpiR0Z6Y3lJNklrMWxjbU5vWVc1MElpd2ljSEp2Wm1sc1pWOXdheUk2TVRFMU56STBOQ3dpYm1GdFpTSTZJbWx1YVhScFlXd2lmUS5KVXFsa213R0FUb29SVGNDbzVCb25sSGZfQXcyMi1wVzMyOUk2anNMZENVSHhOM250T2pHR2p4U1hIa0JIOEQzRE4tNkNfOE41aTdrTGhwTUpZOC1wZw=='
const INTEGRATION_ID = 5636840

router.post('/init', async (req, res) => {
  try {
    const { amount, customerName, customerEmail, customerPhone, orderId } = req.body

    const authRes = await axios.post('https://accept.paymob.com/api/auth/tokens', {
      api_key: PAYMOB_API_KEY
    })
    const token = authRes.data.token

    const orderRes = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
      auth_token: token,
      delivery_needed: false,
      amount_cents: amount * 100,
      currency: 'EGP',
      merchant_order_id: String(orderId),
      items: []
    })
    const paymobOrderId = orderRes.data.id

    const payKeyRes = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
      auth_token: token,
      amount_cents: amount * 100,
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: {
        first_name: customerName || 'Ahmed',
        last_name: 'Customer',
        email: customerEmail || 'customer@email.com',
        phone_number: customerPhone || '01012345678',
        apartment: 'NA',
        floor: 'NA',
        street: 'NA',
        building: 'NA',
        shipping_method: 'NA',
        postal_code: 'NA',
        city: 'Cairo',
        country: 'EG',
        state: 'Cairo'
      },
      currency: 'EGP',
      integration_id: INTEGRATION_ID
    })
    const paymentKey = payKeyRes.data.token
const paymentUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=egy_pk_live_MKP5GHf4V3Q9kk7enbN22gPGvLt66NKc&clientSecret=${paymentKey}`
    res.json({ message: 'Payment initialized!', paymentUrl, paymentKey })
  } catch (err) {
    const errMsg = err.response ? JSON.stringify(err.response.data) : err.message
    res.status(500).json({ message: errMsg })
  }
})

module.exports = router