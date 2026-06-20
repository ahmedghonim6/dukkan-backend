const express = require('express')
const router = express.Router()
const supabase = require('../database')

router.post('/', async (req, res) => {
  try {
    const { storeId, type, title, message } = req.body
    if (!storeId || !type || !title) {
      return res.status(400).json({ message: 'storeId, type, title required' })
    }
    const { data, error } = await supabase
      .from('notifications')
      .insert([{ store_id: storeId, type, title, message: message || '' }])
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    res.status(201).json({ message: 'Notification created', notification: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:storeId', async (req, res) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('store_id', req.params.storeId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ notifications: data })
})

router.patch('/:id/read', async (req, res) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Marked as read', notification: data })
})

router.patch('/:storeId/read-all', async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('store_id', req.params.storeId)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'All marked as read' })
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('notifications').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Deleted' })
})

module.exports = router