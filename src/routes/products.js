const express = require('express')
const router = express.Router()
const supabase = require('../database')

router.post('/', async (req, res) => {
  try {
    const { name, price, comparePrice, storeId, description, stock, options, relatedIds } = req.body
    if (!name || !price || !storeId) return res.status(400).json({ message: 'name, price, storeId required' })
    const { data, error } = await supabase.from('products').insert([{ name, price, compare_price: comparePrice||null, description: description||'', stock: stock||0, store_id: storeId, options: options||[], related_ids: relatedIds||[], images: req.body.images||[] }])
    if (error) return res.status(500).json({ message: error.message })
    res.status(201).json({ message: 'Product created!', product: data })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.get('/:storeId', async (req, res) => {
  const { data, error } = await supabase.from('products').select('*').eq('store_id', req.params.storeId)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ products: data })
})
router.patch('/:id', async (req, res) => {
  try {
    const { name, price, description, stock, options, relatedIds, images } = req.body
    const { data, error } = await supabase
      .from('products')
      .update({ name, price, description, stock, options, related_ids: relatedIds, images })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    res.json({ message: 'Product updated!', product: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})
module.exports = router
