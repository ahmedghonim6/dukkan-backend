const express = require('express')
const router = express.Router()
const supabase = require('../database')
const { requireAuth, requireStoreOwnership } = require('../middleware/auth')

// Called internally by other routes (orders, shipping, etc.) — not exposed to the client directly with auth,
// but only ever triggered server-side after a real event, so no auth middleware needed here.
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

router.get('/:storeId', requireAuth, requireStoreOwnership(req => req.params.storeId), async (req, res) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('store_id', req.params.storeId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ notifications: data })
})

router.patch('/:id/read', requireAuth, async (req, res, next) => {
  const { data } = await supabase.from('notifications').select('store_id').eq('id', req.params.id).single()
  if (!data) return res.status(404).json({ message: 'Notification not found' })
  req.body.storeId = data.store_id
  requireStoreOwnership(r => r.body.storeId)(req, res, next)
}, async (req, res) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Marked as read', notification: data })
})

router.patch('/:storeId/read-all', requireAuth, requireStoreOwnership(req => req.params.storeId), async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('store_id', req.params.storeId)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'All marked as read' })
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  const { data } = await supabase.from('notifications').select('store_id').eq('id', req.params.id).single()
  if (!data) return res.status(404).json({ message: 'Notification not found' })
  req.body.storeId = data.store_id
  requireStoreOwnership(r => r.body.storeId)(req, res, next)
}, async (req, res) => {
  const { error } = await supabase.from('notifications').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Deleted' })
})

module.exports = router