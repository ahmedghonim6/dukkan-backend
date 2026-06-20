const express = require('express')
const router = express.Router()
const supabase = require('../database')

router.post('/', async (req, res) => {
  try {
    const { storeId, code, type, value, minOrder, maxUses, expiresAt } = req.body
    if (!storeId || !code || !type || !value) {
      return res.status(400).json({ message: 'storeId, code, type, value required' })
    }
    const { data, error } = await supabase
      .from('coupons')
      .insert([{
        store_id: storeId,
        code: code.toUpperCase(),
        type, value,
        min_order: minOrder || 0,
        max_uses: maxUses || null,
        expires_at: expiresAt || null
      }])
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    res.status(201).json({ message: 'Coupon created!', coupon: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:storeId', async (req, res) => {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('store_id', req.params.storeId)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ message: error.message })
  res.json({ coupons: data })
})

router.post('/validate', async (req, res) => {
  try {
    const { code, storeId, orderTotal } = req.body
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('store_id', storeId)
      .eq('code', code.toUpperCase())
      .eq('active', true)
      .single()
    if (error || !coupon) return res.status(404).json({ message: 'Invalid coupon code' })
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({ message: 'Coupon has expired' })
    }
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({ message: 'Coupon usage limit reached' })
    }
    if (orderTotal < coupon.min_order) {
      return res.status(400).json({ message: `Minimum order of ${coupon.min_order} required` })
    }
    let discount = 0
    if (coupon.type === 'percentage') discount = orderTotal * (coupon.value / 100)
    else if (coupon.type === 'fixed') discount = coupon.value
    else if (coupon.type === 'free_shipping') discount = 0
    discount = Math.min(discount, orderTotal)
    res.json({ valid: true, coupon, discount: parseFloat(discount.toFixed(2)) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.patch('/:id/use', async (req, res) => {
  const { data: coupon } = await supabase.from('coupons').select('used_count').eq('id', req.params.id).single()
  if (coupon) {
    await supabase.from('coupons').update({ used_count: coupon.used_count + 1 }).eq('id', req.params.id)
  }
  res.json({ message: 'Coupon usage recorded' })
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('coupons').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Coupon deleted' })
})

module.exports = router