const express = require('express')
const router = express.Router()
const supabase = require('../database')
const { requireAuth, requireStoreOwnership } = require('../middleware/auth')

router.post('/', requireAuth, async (req, res) => {
  try {
    const name = req.body.name
    const userId = req.userId // from verified token, not trusted client input
    if (!name) {
      return res.status(400).json({ message: 'Name required' })
    }
    const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-5)
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

router.get('/slug/:slug', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', req.params.slug)
      .single()
    if (error || !data) return res.status(404).json({ message: 'Store not found' })
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', data.id)
    res.json({ store: data, products: products || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Only returns the logged-in user's own stores — never all stores on the platform
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', req.userId)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ stores: data })
})

router.patch('/:id', requireAuth, requireStoreOwnership(req => req.params.id), async (req, res) => {
  try {
    const { name, slug, phone, description, city, theme, customization, meta_title, meta_description, meta_pixel_id, tiktok_pixel_id, google_analytics_id } = req.body
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug
    if (phone !== undefined) updateData.phone = phone
    if (description !== undefined) updateData.description = description
    if (city !== undefined) updateData.city = city
    if (theme !== undefined) updateData.theme = theme
    if (customization !== undefined) updateData.customization = customization
    if (meta_title !== undefined) updateData.meta_title = meta_title
    if (meta_description !== undefined) updateData.meta_description = meta_description
    if (meta_pixel_id !== undefined) updateData.meta_pixel_id = meta_pixel_id
    if (tiktok_pixel_id !== undefined) updateData.tiktok_pixel_id = tiktok_pixel_id
    if (google_analytics_id !== undefined) updateData.google_analytics_id = google_analytics_id

    if (updateData.slug) {
      const { data: existing } = await supabase
        .from('stores')
        .select('id')
        .eq('slug', updateData.slug)
        .neq('id', req.params.id)
        .single()
      if (existing) return res.status(400).json({ message: 'This store URL is already taken. Please choose another.' })
    }

    const { data, error } = await supabase
      .from('stores')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    res.json({ message: 'Store updated!', store: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router