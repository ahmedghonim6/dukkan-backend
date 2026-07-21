const express = require('express')
const router = express.Router()
const supabase = require('../database')
const axios = require('axios')
const { requireAuth, requireStoreOwnership } = require('../middleware/auth')

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

// Public: customers place orders without being logged in as a merchant.
// To prevent price tampering, we recalculate the total server-side from real product prices.
router.post('/', async (req, res) => {
  try {
    const { customerName, customerPhone, customerAddress, customerCity, storeId, items, couponCode, discountAmount } = req.body
    if (!customerName || !customerPhone || !storeId) {
      return res.status(400).json({ message: 'All fields required' })
    }
    if (!items || !items.length) {
      return res.status(400).json({ message: 'Cart is empty' })
    }

    // Recompute the real total from the database instead of trusting the client-sent total
    const productIds = items.map(i => i.id)
    const { data: dbProducts, error: prodErr } = await supabase
      .from('products')
      .select('id, price, stock')
      .in('id', productIds)
    if (prodErr) return res.status(500).json({ message: prodErr.message })

    let realTotal = 0
    for (const item of items) {
      const dbProduct = dbProducts.find(p => p.id === item.id)
      if (!dbProduct) return res.status(400).json({ message: 'One or more products no longer exist' })
      if (dbProduct.stock != null && dbProduct.stock < item.qty) {
        return res.status(400).json({ message: `Not enough stock for one of the items` })
      }
      realTotal += parseFloat(dbProduct.price) * item.qty
    }

    let finalDiscount = 0
    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('store_id', storeId)
        .eq('code', couponCode.toUpperCase())
        .eq('active', true)
        .single()
      if (coupon) {
        if (coupon.type === 'percentage') finalDiscount = realTotal * (coupon.value / 100)
        else if (coupon.type === 'fixed') finalDiscount = coupon.value
        finalDiscount = Math.min(finalDiscount, realTotal)
      }
    }
    const finalTotal = Math.max(0, realTotal - finalDiscount)

    const { data, error } = await supabase
      .from('orders')
      .insert([{
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        customer_city: customerCity || null,
        store_id: storeId,
        total: finalTotal,
        items: items || [],
        coupon_code: couponCode || null,
        discount_amount: finalDiscount,
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
      const msg = 'New Order!\n\nCustomer: ' + customerName + '\nPhone: ' + customerPhone + '\nAddress: ' + customerAddress + '\nTotal: ' + finalTotal
      await sendWhatsApp(storeData.phone, msg)
    }

    if (items && items.length > 0) {
      for (const item of items) {
        await supabase.rpc('decrement_stock', { product_id: item.id, qty: item.qty })
      }
    }

    await supabase.from('notifications').insert([{
      store_id: storeId,
      type: 'new_order',
      title: 'New Order!',
      message: customerName + ' placed an order for ' + finalTotal
    }])

    res.status(201).json({ message: 'Order created!', order: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:storeId', requireAuth, requireStoreOwnership(req => req.params.storeId), async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = Math.min(parseInt(req.query.limit) || 50, 100)
  const offset = (page - 1) * limit
  const { data, error, count } = await supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('store_id', req.params.storeId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ orders: data, total: count, page, limit })
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  const { data } = await supabase.from('orders').select('store_id').eq('id', req.params.id).single()
  if (!data) return res.status(404).json({ message: 'Order not found' })
  req.body.storeId = data.store_id
  requireStoreOwnership(r => r.body.storeId)(req, res, next)
}, async (req, res) => {
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