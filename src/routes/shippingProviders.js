// ══ SHIPPING PROVIDER ADAPTER ARCHITECTURE ══
// Each adapter implements: createShipment(), trackShipment(), cancelShipment()
// Real providers (Bosta, Aramex, etc.) plug in here later without touching core logic.

class BaseShippingAdapter {
  constructor(credentials) {
    this.credentials = credentials || {}
  }
  async createShipment(orderData) {
    throw new Error('createShipment not implemented')
  }
  async trackShipment(trackingNumber) {
    throw new Error('trackShipment not implemented')
  }
  async cancelShipment(trackingNumber) {
    throw new Error('cancelShipment not implemented')
  }
  async testConnection() {
    throw new Error('testConnection not implemented')
  }
}

// ══ MOCK PROVIDER — simulates real provider behavior for testing ══
class MockShippingAdapter extends BaseShippingAdapter {
  async testConnection() {
    return { success: true, message: 'Mock connection successful' }
  }

  async createShipment(orderData) {
    const trackingNumber = 'MOCK-' + Date.now().toString().slice(-8)
    return {
      success: true,
      trackingNumber,
      shipmentIdExternal: 'SHP-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      status: 'created',
      providerResponse: {
        message: 'Shipment created successfully (simulated)',
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        cost: orderData.shippingCost || 35
      }
    }
  }

  async trackShipment(trackingNumber) {
    // Simulate a realistic progression based on time since creation
    const statuses = ['created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered']
    const randomIndex = Math.floor(Math.random() * statuses.length)
    return {
      success: true,
      status: statuses[randomIndex],
      events: statuses.slice(0, randomIndex + 1).map((s, i) => ({
        status: s,
        occurredAt: new Date(Date.now() - (statuses.length - i) * 3600000).toISOString()
      }))
    }
  }

  async cancelShipment(trackingNumber) {
    return { success: true, message: 'Shipment cancelled (simulated)' }
  }
}

// ══ REAL PROVIDER STUBS — ready for future API integration ══
class BostaAdapter extends BaseShippingAdapter {
  async testConnection() {
    return { success: false, message: 'Bosta API not yet connected. Add API credentials in Shipping Settings.' }
  }
  async createShipment(orderData) {
    throw new Error('Bosta integration pending — API key required')
  }
  async trackShipment(trackingNumber) {
    throw new Error('Bosta integration pending — API key required')
  }
  async cancelShipment(trackingNumber) {
    throw new Error('Bosta integration pending — API key required')
  }
}

class AramexAdapter extends BaseShippingAdapter {
  async testConnection() {
    return { success: false, message: 'Aramex API not yet connected. Add API credentials in Shipping Settings.' }
  }
  async createShipment(orderData) {
    throw new Error('Aramex integration pending — API key required')
  }
}

// Generic stub for remaining providers until real APIs are added
class PendingAdapter extends BaseShippingAdapter {
  constructor(credentials, providerName) {
    super(credentials)
    this.providerName = providerName
  }
  async testConnection() {
    return { success: false, message: `${this.providerName} integration pending — API credentials required.` }
  }
  async createShipment() {
    throw new Error(`${this.providerName} integration pending — API credentials required.`)
  }
  async trackShipment() {
    throw new Error(`${this.providerName} integration pending — API credentials required.`)
  }
  async cancelShipment() {
    throw new Error(`${this.providerName} integration pending — API credentials required.`)
  }
}

// ══ FACTORY — returns the right adapter for a provider code ══
function getAdapter(providerCode, credentials) {
  switch (providerCode) {
    case 'mock': return new MockShippingAdapter(credentials)
    case 'bosta': return new BostaAdapter(credentials)
    case 'aramex': return new AramexAdapter(credentials)
    case 'shipblu': return new PendingAdapter(credentials, 'ShipBlu')
    case 'mylerz': return new PendingAdapter(credentials, 'Mylerz')
    case 'r2s': return new PendingAdapter(credentials, 'R2S Logistics')
    case 'flextock': return new PendingAdapter(credentials, 'Flextock')
    case 'dhl': return new PendingAdapter(credentials, 'DHL')
    default: return new PendingAdapter(credentials, providerCode)
  }
}

module.exports = { getAdapter, BaseShippingAdapter, MockShippingAdapter }