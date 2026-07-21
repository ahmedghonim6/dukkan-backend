const express = require('express')
const router = express.Router()
const supabase = require('../database')
const { requireAuth, requireStoreOwnership } = require('../middleware/auth')

router.post('/', requireAuth, requireStoreOwnership(req => req.body.storeId), async (req, res) => {
  try {
    const { name, price, comparePrice, storeId, description, stock, options, relatedIds } = req.body
    if (!name || !price || !storeId) return res.status(400).json({ message: 'name, price, storeId required' })
    const { data, error } = await supabase
      .from('products')
      .insert([{ name, price, compare_price: comparePrice||null, description: description||'', stock: stock||0, store_id: storeId, options: options||[], related_ids: relatedIds||[], images: req.body.images||[] }])
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    res.status(201).json({ message: 'Product created!', product: data })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.get('/:storeId', async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = Math.min(parseInt(req.query.limit) || 50, 100)
  const offset = (page - 1) * limit
  const { data, error, count } = await supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('store_id', req.params.storeId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ products: data, total: count, page, limit })
})

// Ownership check for update/delete needs the product's store_id looked up first
async function getStoreIdFromProduct(req) {
  const { data } = await supabase.from('products').select('store_id').eq('id', req.params.id).single()
  return data?.store_id
}

router.patch('/:id', requireAuth, async (req, res, next) => {
  const storeId = await getStoreIdFromProduct(req)
  if (!storeId) return res.status(404).json({ message: 'Product not found' })
  req.body.storeId = storeId
  requireStoreOwnership(r => r.body.storeId)(req, res, next)
}, async (req, res) => {
  try {
    const { name, price, comparePrice, description, stock, options, relatedIds, images } = req.body
    const { data, error } = await supabase
      .from('products')
      .update({ name, price, compare_price: comparePrice, description, stock, options, related_ids: relatedIds, images })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    res.json({ message: 'Product updated!', product: data })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  const storeId = await getStoreIdFromProduct(req)
  if (!storeId) return res.status(404).json({ message: 'Product not found' })
  req.body.storeId = storeId
  requireStoreOwnership(r => r.body.storeId)(req, res, next)
}, async (req, res) => {
  const { error } = await supabase.from('products').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Product deleted' })
})

module.exports = router