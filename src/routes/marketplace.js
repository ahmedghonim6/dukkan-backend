const express = require('express')
const router = express.Router()
const supabase = require('../database')
const { requireAuth, requireStoreOwnership } = require('../middleware/auth')

// ══ PUBLIC BROWSING ROUTES (no auth — anyone can discover the marketplace) ══

router.get('/home', async (req, res) => {
  try {
    const [storesRes, productsRes, categoriesRes] = await Promise.all([
      supabase.from('mp_store_profiles').select('*').eq('is_enabled', true).eq('is_featured', true).limit(6),
      supabase.from('mp_product_profiles').select('*').eq('is_enabled', true).order('total_orders', { ascending: false }).limit(12),
      supabase.from('mp_categories').select('*').eq('is_active', true).order('sort_order').limit(12)
    ])
    res.json({
      featured_stores: storesRes.data || [],
      top_products: productsRes.data || [],
      categories: categoriesRes.data || []
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/categories', async (req, res) => {
  const { data, error } = await supabase.from('mp_categories').select('*').eq('is_active', true).order('sort_order')
  if (error) return res.status(500).json({ message: error.message })
  res.json({ categories: data })
})

router.get('/search', async (req, res) => {
  try {
    const { q, category, min_price, max_price, sort = 'popular', page = 1, limit = 20 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)

    let query = supabase
      .from('mp_product_profiles')
      .select('*, store:store_id(*)', { count: 'exact' })
      .eq('is_enabled', true)

    if (category) query = query.eq('category_id', category)

    switch(sort) {
      case 'rating': query = query.order('avg_rating', { ascending: false }); break
      case 'newest': query = query.order('created_at', { ascending: false }); break
      case 'popular': default: query = query.order('total_orders', { ascending: false }); break
    }

    query = query.range(offset, offset + parseInt(limit) - 1)
    const { data, error, count } = await query
    if (error) throw error

    if (q) {
      await supabase.from('mp_search_logs').insert([{
        query: q,
        query_normalized: q.toLowerCase().trim(),
        results_count: count || 0,
        has_results: (count || 0) > 0
      }])
    }

    res.json({ products: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/stores/:storeId', async (req, res) => {
  try {
    const [profileRes, productsRes, reviewsRes] = await Promise.all([
      supabase.from('mp_store_profiles').select('*').eq('store_id', req.params.storeId).eq('is_enabled', true).single(),
      supabase.from('mp_product_profiles').select('*').eq('store_id', req.params.storeId).eq('is_enabled', true).order('total_orders', { ascending: false }).limit(12),
      supabase.from('mp_store_reviews').select('*').eq('store_id', req.params.storeId).eq('status', 'approved').order('created_at', { ascending: false }).limit(5)
    ])
    if (!profileRes.data) return res.status(404).json({ message: 'Store not found in marketplace' })

    await supabase.from('mp_events').insert([{
      event_type: 'store_viewed',
      store_id: req.params.storeId,
      session_id: req.headers['x-session-id'] || null
    }])

    res.json({
      profile: profileRes.data,
      products: productsRes.data || [],
      reviews: reviewsRes.data || []
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/stores', async (req, res) => {
  try {
    const { category, page = 1, limit = 12 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)

    let query = supabase
      .from('mp_store_profiles')
      .select('*', { count: 'exact' })
      .eq('is_enabled', true)

    if (category) query = query.eq('primary_category', category)

    query = query.order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1)

    const { data, error, count } = await query
    if (error) throw error
    res.json({ stores: data || [], total: count || 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/reviews', async (req, res) => {
  try {
    const { storeId, reviewerName, rating, title, comment } = req.body
    if (!storeId || !reviewerName || !rating) return res.status(400).json({ message: 'storeId, reviewerName, rating required' })
    const { data, error } = await supabase.from('mp_store_reviews')
      .insert([{ store_id: storeId, reviewer_name: reviewerName, rating, title, comment }])
      .select().single()
    if (error) throw error
    res.status(201).json({ message: 'Review submitted!', review: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/stores/:storeId/follow', async (req, res) => {
  try {
    const { visitorId } = req.body
    if (!visitorId) return res.status(400).json({ message: 'visitorId required' })
    await supabase.from('mp_store_followers').upsert([{
      store_id: req.params.storeId, visitor_id: visitorId
    }], { onConflict: 'store_id,visitor_id' })
    res.json({ followed: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/reports', async (req, res) => {
  try {
    const { entityType, entityId, reason, reasonCode, reporterSession } = req.body
    if (!entityType || !entityId || !reason) {
      return res.status(400).json({ message: 'entityType, entityId, reason required' })
    }
    await supabase.from('mp_reports').insert([{
      entity_type: entityType, entity_id: entityId,
      reason, reason_code: reasonCode || 'user_report',
      reporter_session: reporterSession || null
    }])
    res.json({ reported: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/events', async (req, res) => {
  try {
    const { eventType, productId, storeId, sessionId, metadata } = req.body
    await supabase.from('mp_events').insert([{
      event_type: eventType, product_id: productId, store_id: storeId,
      session_id: sessionId, metadata: metadata || {}
    }])
    if (productId && eventType === 'product_viewed') {
      await supabase.rpc('increment_product_view', { p_product_id: productId })
    }
    res.json({ tracked: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Public: anyone browsing the marketplace can see a store's trust score/grade
router.get('/stores/:storeId/trust-score', async (req, res) => {
  const { data } = await supabase
    .from('mp_trust_scores')
    .select('total_score, grade, completed_orders')
    .eq('store_id', req.params.storeId)
    .single()
  res.json({ trust_score: data || null })
})

// ══ MERCHANT-ONLY ROUTES (require ownership of the store) ══

router.post('/join', requireAuth, requireStoreOwnership(req => req.body.storeId), async (req, res) => {
  try {
    const { storeId, primaryCategory, description } = req.body

    const { data: storeData } = await supabase.from('stores').select('name,slug,description').eq('id', storeId).single()
    if (!storeData) return res.status(404).json({ message: 'Store not found' })

    const { data: existing } = await supabase.from('mp_store_profiles').select('id').eq('store_id', storeId).single()

    let result
    if (existing) {
      const { data, error } = await supabase.from('mp_store_profiles')
        .update({ is_enabled: true, primary_category: primaryCategory, marketplace_description: description, joined_at: new Date().toISOString() })
        .eq('store_id', storeId).select().single()
      if (error) throw error
      result = data
    } else {
      const { data, error } = await supabase.from('mp_store_profiles')
        .insert([{ store_id: storeId, is_enabled: true, primary_category: primaryCategory, marketplace_description: description || storeData.description, joined_at: new Date().toISOString() }])
        .select().single()
      if (error) throw error
      result = data
    }

    await supabase.from('mp_merchant_settings').upsert([{ store_id: storeId, marketplace_enabled: true }], { onConflict: 'store_id' })
    await supabase.from('mp_notifications').insert([{ store_id: storeId, notification_type: 'announcement', title: 'Welcome to Dukkan Marketplace!', message: 'Your store is now visible to thousands of customers.' }])

    res.status(201).json({ message: 'Joined marketplace!', profile: result })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/leave', requireAuth, requireStoreOwnership(req => req.body.storeId), async (req, res) => {
  try {
    const { storeId } = req.body
    await supabase.from('mp_store_profiles').update({ is_enabled: false }).eq('store_id', storeId)
    await supabase.from('mp_product_profiles').update({ is_enabled: false }).eq('store_id', storeId)
    await supabase.from('mp_merchant_settings').update({ marketplace_enabled: false }).eq('store_id', storeId)
    res.json({ message: 'Left marketplace. Your store data is intact.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/products/publish', requireAuth, requireStoreOwnership(req => req.body.storeId), async (req, res) => {
  try {
    const { productId, storeId, categoryId, tags } = req.body
    if (!productId) return res.status(400).json({ message: 'productId required' })

    const { data: settings } = await supabase.from('mp_merchant_settings').select('marketplace_enabled').eq('store_id', storeId).single()
    if (!settings?.marketplace_enabled) return res.status(403).json({ message: 'Store not in marketplace. Join first.' })

    // Confirm the product actually belongs to this store before publishing it
    const { data: product } = await supabase.from('products').select('id, store_id').eq('id', productId).single()
    if (!product || product.store_id !== storeId) return res.status(403).json({ message: 'This product does not belong to your store' })

    const { data, error } = await supabase.from('mp_product_profiles').upsert([{
      product_id: productId, store_id: storeId, category_id: categoryId, tags: tags || [], is_enabled: true
    }], { onConflict: 'product_id' }).select().single()
    if (error) throw error

    res.status(201).json({ message: 'Product published to marketplace!', profile: data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/products/unpublish', requireAuth, async (req, res, next) => {
  const { data } = await supabase.from('mp_product_profiles').select('store_id').eq('product_id', req.body.productId).single()
  if (!data) return res.status(404).json({ message: 'Product not found in marketplace' })
  req.body.storeId = data.store_id
  requireStoreOwnership(r => r.body.storeId)(req, res, next)
}, async (req, res) => {
  try {
    const { productId } = req.body
    await supabase.from('mp_product_profiles').update({ is_enabled: false }).eq('product_id', productId)
    res.json({ message: 'Product removed from marketplace' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/settings/:storeId', requireAuth, requireStoreOwnership(req => req.params.storeId), async (req, res) => {
  const { data } = await supabase.from('mp_merchant_settings').select('*').eq('store_id', req.params.storeId).single()
  const { data: profile } = await supabase.from('mp_store_profiles').select('*').eq('store_id', req.params.storeId).single()
  const { data: trust_score } = await supabase.from('mp_trust_scores').select('*').eq('store_id', req.params.storeId).single()
  res.json({ settings: data, profile, trust_score })
})

router.get('/notifications/:storeId', requireAuth, requireStoreOwnership(req => req.params.storeId), async (req, res) => {
  const { data } = await supabase.from('mp_notifications').select('*').eq('store_id', req.params.storeId).order('created_at', { ascending: false }).limit(20)
  res.json({ notifications: data || [] })
})

router.get('/analytics/:storeId', requireAuth, requireStoreOwnership(req => req.params.storeId), async (req, res) => {
  try {
    const [eventsRes, productsRes] = await Promise.all([
      supabase.from('mp_events').select('event_type').eq('store_id', req.params.storeId),
      supabase.from('mp_product_profiles').select('total_views, total_orders, total_revenue').eq('store_id', req.params.storeId)
    ])
    const events = eventsRes.data || []
    const products = productsRes.data || []
    res.json({
      impressions: events.filter(e => e.event_type === 'store_viewed').length,
      product_views: products.reduce((s, p) => s + (p.total_views || 0), 0),
      marketplace_orders: products.reduce((s, p) => s + (p.total_orders || 0), 0),
      marketplace_revenue: products.reduce((s, p) => s + (parseFloat(p.total_revenue) || 0), 0)
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router