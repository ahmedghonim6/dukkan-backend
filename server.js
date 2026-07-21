require('dotenv').config()
const rateLimit = require('express-rate-limit')

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' }
})

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: 'Too many requests. Please slow down.' }
})
const rateLimit = require('express-rate-limit')

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
})

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { message: 'Too many requests. Please slow down.' }
})
const express = require('express')
const cors = require('cors')
const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json({ strict: false }))
app.use(express.urlencoded({ extended: true }))
app.use((req,res,next)=>{console.log('Body:',req.body);next()})
const authRoutes = require('./src/routes/auth')
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api', apiLimiter)
app.use('/api', apiLimiter) // general limit on everything else
const storeRoutes = require('./src/routes/stores')
app.use('/api/stores', storeRoutes)
const productRoutes = require('./src/routes/products')
app.use('/api/products', productRoutes)
const orderRoutes = require('./src/routes/orders')
app.use('/api/orders', orderRoutes)
const paymentRoutes = require('./src/routes/payments')
app.use('/api/payments', paymentRoutes)
app.get('/',(req,res)=>res.json({message:'Dukkan API is running!'}))
const shippingRoutes = require('./src/routes/shipping')
app.use('/api/shipping', shippingRoutes)
app.listen(5000,()=>console.log('Server running on port 5000'))
const uploadRoutes = require('./src/routes/upload')
app.use('/api/upload', uploadRoutes)
const couponRoutes = require('./src/routes/coupons')
app.use('/api/coupons', couponRoutes)
const reviewRoutes = require('./src/routes/reviews')
app.use('/api/reviews', reviewRoutes)
const notificationRoutes = require('./src/routes/notifications')
app.use('/api/notifications', notificationRoutes)
const marketplaceRoutes = require('./src/routes/marketplace')
app.use('/api/marketplace', marketplaceRoutes)