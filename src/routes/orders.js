const express = require('express')
const router = express.Router()
const supabase = require('../database')

router.post('/', async (req, res) => {
  try {
    const customerName = req.body.customerName
    const customerPhone = req.body.customerPhone
    const customerAddress = req.body.customerAddress
    const storeId = req.body.storeId
    const total = req.body.total
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

module.exports = router