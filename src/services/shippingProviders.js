const express = require('express')
const router = express.Router()
const supabase = require('../database')
const { getAdapter } = require('../services/shippingProviders')

// ══ LOG HELPER ══
async function logShipping(storeId, shipmentId, providerCode, action, level, message, payload) {
  try {
    await supabase.from('shipping_logs').insert([{
      store_id: storeId, shipment_id: shipmentId, provider_code: providerCode,
      action, level, message, payload: payload || {}
    }])
  } catch (e) { console.log('Log error:', e.message) }
}

// ══ GET ALL AVAILABLE PROVIDERS ══
router.get('/providers', async (req, res) => {
  const { data, error } = await supabase
    .from('shipping_providers')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) return res.status(500).json({ message: error.message })
  res.json({ providers: data })
})

// ══ GET MERCHANT'S CONNECTED ACCOUNTS ══
router.get('/accounts/:storeId', async (req, res) => {
  const { data, error } = await supabase
    .from('shipping_accounts')
    .select('*')
    .eq('store_id', req.params.storeId)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ accounts: data })
})

// ══ CONNECT A PROVIDER ══
router.post('/connect', async (req, res) => {
  try {
    const { storeId, providerCode, credentials } = req.body
    if (!storeId || !providerCode) {
      return res.status(400).json({ message: 'storeId and providerCode required' })
    }
    const { data: existing } = await supabase
      .from('shipping_accounts')
      .select('id')
      .eq('store_id', storeId)
      .eq('provider_code', providerCode)
      .single()

    let result
    if (existing) {
      const { data, error } = await supabase
        .from('shipping_accounts')
        .update({ credentials: credentials || {}, status: 'pending' })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      result = data
    } else {
      const { data, error } = await supabase
        .from('shipping_accounts')
        .insert([{ store_id: storeId, provider_code: providerCode, credentials: credentials || {}, status: 'pending' }])
        .select()
        .single()
      if (error) throw error
      result = data
    }
    await logShipping(storeId, null, providerCode, 'connect', 'info', 'Provider connection saved')
    res.status(201).json({ message: 'Provider connected!', account: result })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══ TEST CONNECTION ══
router.post('/test/:accountId', async (req, res) => {
  try {
    const { data: account, error } = await supabase
      .from('shipping_accounts')
      .select('*')
      .eq('id', req.params.accountId)
      .single()
    if (error || !account) return res.status(404).json({ message: 'Account not found' })

    const adapter = getAdapter(account.provider_code, account.credentials)
    const result = await adapter.testConnection()

    const newStatus = result.success ? 'connected' : 'failed'
    await supabase
      .from('shipping_accounts')
      .update({ status: newStatus, last_tested_at: new Date().toISOString() })
      .eq('id', account.id)

    await logShipping(account.store_id, null, account.provider_code, 'test_connection',
      result.success ? 'info' : 'error', result.message)

    res.json({ ...result, status: newStatus })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══ DISCONNECT PROVIDER ══
router.delete('/accounts/:accountId', async (req, res) => {
  const { error } = await supabase.from('shipping_accounts').delete().eq('id', req.params.accountId)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Disconnected' })
})

// ══ TOGGLE AUTO-CREATE SHIPMENT ══
router.patch('/accounts/:accountId/auto-create', async (req, res) => {
  const { data, error } = await supabase
    .from('shipping_accounts')
    .update({ auto_create: req.body.autoCreate })
    .eq('id', req.params.accountId)
    .select()
    .single()
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Updated', account: data })
})

// ══ CREATE SHIPMENT FROM ORDER ══
router.post('/shipments', async (req, res) => {
  try {
    const { orderId, storeId, providerCode, customerName, customerPhone, customerAddress, city, governorate, codAmount, shippingCost } = req.body
    if (!orderId || !storeId || !providerCode) {
      return res.status(400).json({ message: 'orderId, storeId, providerCode required' })
    }

    const { data: account } = await supabase
      .from('shipping_accounts')
      .select('*')
      .eq('store_id', storeId)
      .eq('provider_code', providerCode)
      .single()

    const adapter = getAdapter(providerCode, account?.credentials || {})

    let shipmentResult
    try {
      shipmentResult = await adapter.createShipment({
        orderId, customerName, customerPhone, customerAddress, city, governorate, codAmount, shippingCost
      })
    } catch (adapterErr) {
      await logShipping(storeId, null, providerCode, 'create_shipment', 'error', adapterErr.message)
      return res.status(400).json({ message: adapterErr.message })
    }

    const { data: shipment, error } = await supabase
      .from('shipments')
      .insert([{
        order_id: orderId, store_id: storeId, provider_code: providerCode,
        tracking_number: shipmentResult.trackingNumber,
        shipment_id_external: shipmentResult.shipmentIdExternal,
        status: shipmentResult.status || 'created',
        cod_amount: codAmount || 0, shipping_cost: shippingCost || 0,
        customer_name: customerName, customer_phone: customerPhone,
        customer_address: customerAddress, city, governorate,
        provider_response: shipmentResult.providerResponse || {}
      }])
      .select()
      .single()
    if (error) throw error

    await supabase.from('shipment_events').insert([{
      shipment_id: shipment.id, status: 'created', note: 'Shipment created'
    }])

    await logShipping(storeId, shipment.id, providerCode, 'create_shipment', 'info', 'Shipment created successfully')

    res.status(201).json({ message: 'Shipment created!', shipment })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══ GET SHIPMENT BY ORDER ══
router.get('/shipments/order/:orderId', async (req, res) => {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('order_id', req.params.orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return res.status(500).json({ message: error.message })
  res.json({ shipment: data })
})

// ══ GET SHIPMENT TIMELINE ══
router.get('/shipments/:shipmentId/events', async (req, res) => {
  const { data, error } = await supabase
    .from('shipment_events')
    .select('*')
    .eq('shipment_id', req.params.shipmentId)
    .order('occurred_at', { ascending: true })
  if (error) return res.status(500).json({ message: error.message })
  res.json({ events: data })
})

// ══ TRACK SHIPMENT (refresh status from provider) ══
router.post('/shipments/:shipmentId/track', async (req, res) => {
  try {
    const { data: shipment, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', req.params.shipmentId)
      .single()
    if (error || !shipment) return res.status(404).json({ message: 'Shipment not found' })

    const { data: account } = await supabase
      .from('shipping_accounts')
      .select('credentials')
      .eq('store_id', shipment.store_id)
      .eq('provider_code', shipment.provider_code)
      .single()

    const adapter = getAdapter(shipment.provider_code, account?.credentials || {})
    const trackResult = await adapter.trackShipment(shipment.tracking_number)

    if (trackResult.status !== shipment.status) {
      await supabase.from('shipments').update({
        status: trackResult.status, updated_at: new Date().toISOString()
      }).eq('id', shipment.id)

      await supabase.from('shipment_events').insert([{
        shipment_id: shipment.id, status: trackResult.status, note: 'Status updated from tracking'
      }])

      // Auto-sync order status
      const orderStatusMap = { delivered: 'delivered', returned: 'cancelled', cancelled: 'cancelled' }
      if (orderStatusMap[trackResult.status]) {
        await supabase.from('orders').update({ status: orderStatusMap[trackResult.status] }).eq('id', shipment.order_id)
      }
    }

    res.json({ message: 'Tracking updated', status: trackResult.status, events: trackResult.events })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══ CANCEL SHIPMENT ══
router.post('/shipments/:shipmentId/cancel', async (req, res) => {
  try {
    const { data: shipment } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', req.params.shipmentId)
      .single()
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' })

    const { data: account } = await supabase
      .from('shipping_accounts')
      .select('credentials')
      .eq('store_id', shipment.store_id)
      .eq('provider_code', shipment.provider_code)
      .single()

    const adapter = getAdapter(shipment.provider_code, account?.credentials || {})
    await adapter.cancelShipment(shipment.tracking_number)

    await supabase.from('shipments').update({ status: 'cancelled' }).eq('id', shipment.id)
    await supabase.from('shipment_events').insert([{ shipment_id: shipment.id, status: 'cancelled', note: 'Cancelled by merchant' }])

    res.json({ message: 'Shipment cancelled' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══ SHIPPING ANALYTICS ══
router.get('/analytics/:storeId', async (req, res) => {
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('store_id', req.params.storeId)
  if (error) return res.status(500).json({ message: error.message })

  const total = shipments.length
  const delivered = shipments.filter(s => s.status === 'delivered').length
  const returned = shipments.filter(s => s.status === 'returned').length
  const failed = shipments.filter(s => s.status === 'failed').length
  const codCollected = shipments.filter(s => s.status === 'delivered').reduce((sum, s) => sum + (parseFloat(s.cod_amount) || 0), 0)

  const byProvider = {}
  shipments.forEach(s => {
    if (!byProvider[s.provider_code]) byProvider[s.provider_code] = { total: 0, delivered: 0 }
    byProvider[s.provider_code].total++
    if (s.status === 'delivered') byProvider[s.provider_code].delivered++
  })

  res.json({
    total, delivered, returned, failed,
    successRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
    codCollected,
    byProvider
  })
})

// ══ PUBLIC TRACKING (for customers) ══
router.get('/track/:trackingNumber', async (req, res) => {
  const { data: shipment, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('tracking_number', req.params.trackingNumber)
    .single()
  if (error || !shipment) return res.status(404).json({ message: 'Tracking number not found' })

  const { data: events } = await supabase
    .from('shipment_events')
    .select('*')
    .eq('shipment_id', shipment.id)
    .order('occurred_at', { ascending: true })

  res.json({ shipment, events: events || [] })
})

// ══ WEBHOOK RECEIVER (for future real providers) ══
router.post('/webhook/:providerCode', async (req, res) => {
  try {
    await supabase.from('shipping_webhooks').insert([{
      provider_code: req.params.providerCode,
      tracking_number: req.body.trackingNumber || req.body.tracking_number || null,
      raw_payload: req.body
    }])
    res.json({ received: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
