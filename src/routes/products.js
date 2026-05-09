const express = require('express')
const router = express.Router()
const supabase = require('../database')

router.post('/', async (req, res) => {
  try {
    const name = req.body.name
    const price = req.body.price
    const storeId = req.body.storeId
    const description = req.body.description || ''
    const stock = req.body.stock || 0
    if (!name || !price || !storeId) {
      return res.status(400).json({ message: 'name, price, storeId required' })
    }
    const { data, error } = await supabase
      .from('products')
      .insert([{ name, price, description, stock, store_id: storeId }])
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    res.status(201).json({ message: 'Product created!', product: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:storeId', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', req.params.storeId)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ products: data })
})

module.exports = router