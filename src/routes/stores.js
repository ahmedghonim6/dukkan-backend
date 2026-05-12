const express = require('express')
const router = express.Router()
const supabase = require('../database')

router.post('/', async (req, res) => {
  try {
    const name = req.body.name
    const userId = req.body.userId
    if (!name || !userId) {
      return res.status(400).json({ message: 'Name and userId required' })
    }
    const slug = name.toLowerCase().replace(/\s+/g, '-')
    const { data, error } = await supabase
      .from('stores')
      .insert([{ name, slug, user_id: userId }])
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    res.status(201).json({ message: 'Store created!', store: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/', async (req, res) => {
  const userId = req.query.userId
  if (userId) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', userId)
    if (error) return res.status(500).json({ message: error.message })
    return res.json({ stores: data })
  }
  const { data, error } = await supabase.from('stores').select('*')
  if (error) return res.status(500).json({ message: error.message })
  res.json({ stores: data })
})

module.exports = router