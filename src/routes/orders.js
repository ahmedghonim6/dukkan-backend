const express = require('express')
const router = express.Router()
const supabase = require('../database')
const axios = require('axios')

async function sendWhatsApp(phone, message) {
  try {
    await axios.post('https://api.ultramsg.com/instance178910/messages/chat', {
      token: 'zzf54tmm2vp7oie5',
      to: phone,
      body: message
    })
  } catch(e) {
    console.log('WhatsApp error:', e.message)
  }
}

router.post('/', async (req, res) => {
  try {
    const { customerName, customerPhone, customerAddress, storeId, total, items } = req.body
    if (!customerName || !customerPhone || !storeId || !total) {
      return res.status(400).json({ message: 'All fields required' })
    }
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        store_id: storeId,
        total,
        status: 'pending'
      }])
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    const { data: storeData } = await supabase
      .from('stores')
      .select('phone, name')
      .eq('id', storeId)
      .single()
    if (storeData && storeData.phone) {
      const msg = 'New Order!\n\nCustomer: ' + customerName + '\nPhone: ' + customerPhone + '\nAddress: ' + customerAddress + '\nTotal: ' + total
      await sendWhatsApp(storeData.phone, msg)
    }
      // Deduct stock
if (items && items.length > 0) {
  for (const item of items) {
    await supabase.rpc('decrement_stock', { product_id: item.id, qty: item.qty })
  }
}
    res.status(201).json({ message: 'Order created!', order: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:storeId', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('store_id', req.params.storeId)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ orders: data })
})

router.patch('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: req.body.status })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Order updated!', order: data })
})
 // Create notification
 await supabase.from('notifications').insert([{
  store_id: storeId,
  type: 'new_order',
  title: 'New Order! 🛍️',
  message: customerName + ' placed an order for ' + total
 }])
module.exports = router