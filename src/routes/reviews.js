const express = require('express')
const router = express.Router()
const supabase = require('../database')

router.post('/', async (req, res) => {
  try {
    const { productId, storeId, customerName, rating, title, comment, images, verified } = req.body
    if (!productId || !storeId || !customerName || !rating) {
      return res.status(400).json({ message: 'Required fields missing' })
    }
    const { data, error } = await supabase
      .from('reviews')
      .insert([{
        product_id: productId, store_id: storeId,
        customer_name: customerName, rating,
        title: title || '', comment: comment || '',
        images: images || [], verified: verified || false
      }])
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    res.status(201).json({ message: 'Review submitted!', review: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/product/:productId', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', req.params.productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ message: error.message })
  res.json({ reviews: data })
})

router.get('/store/:storeId', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('store_id', req.params.storeId)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ message: error.message })
  res.json({ reviews: data })
})

router.patch('/:id/status', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .update({ status: req.body.status })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Review updated!', review: data })
})

router.patch('/:id/reply', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .update({ merchant_reply: req.body.reply })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Reply added!', review: data })
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('reviews').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Review deleted' })
})

module.exports = router