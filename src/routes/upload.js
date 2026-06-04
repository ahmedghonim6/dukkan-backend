const express = require('express')
const router = express.Router()
const supabase = require('../database')
const multer = require('multer')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only images allowed'))
  }
})

router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' })
    }
    const urls = []
    for (const file of req.files) {
      const ext = file.originalname.split('.').pop()
      const fileName = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
      const { error } = await supabase.storage
        .from('products')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })
      if (error) {
        console.log('Upload error:', error.message)
        continue
      }
      const { data } = supabase.storage
        .from('products')
        .getPublicUrl(fileName)
      urls.push(data.publicUrl)
    }
    if (urls.length === 0) {
      return res.status(500).json({ message: 'Failed to upload images' })
    }
    res.json({ urls })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router