const express = require('express')
const router = express.Router()
const supabase = require('../database')
const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage() })

router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    const urls = []
    for (const file of req.files) {
      const fileName = Date.now() + '-' + file.originalname.replace(/\s/g, '-')
      const { error } = await supabase.storage
        .from('products')
        .upload(fileName, file.buffer, { contentType: file.mimetype })
      if (error) continue
      const { data } = supabase.storage.from('products').getPublicUrl(fileName)
      urls.push(data.publicUrl)
    }
    res.json({ urls })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router