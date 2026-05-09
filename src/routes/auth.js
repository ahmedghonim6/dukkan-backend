const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const router = express.Router()
const supabase = require('../database')
const SECRET = 'dukkan_secret_key_2025'

router.post('/register', async (req, res) => {
  try {
    const name = req.body.name
    const email = req.body.email
    const phone = req.body.phone
    const password = req.body.password
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields required' })
    }
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()
    if (existing) {
      return res.status(400).json({ message: 'Email already exists' })
    }
    const hashed = await bcrypt.hash(password, 10)
    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, phone, password: hashed }])
      .select()
      .single()
    if (error) return res.status(500).json({ message: error.message })
    const token = jwt.sign({ id: data.id }, SECRET, { expiresIn: '7d' })
    res.status(201).json({ message: 'Account created!', token, user: { id: data.id, name, email } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/login', async (req, res) => {
  try {
    const email = req.body.email
    const password = req.body.password
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()
    if (error || !user) return res.status(400).json({ message: 'Invalid credentials' })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ message: 'Invalid credentials' })
    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' })
    res.json({ message: 'Welcome back!', token, user: { id: user.id, name: user.name, email } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router