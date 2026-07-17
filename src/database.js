const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  'https://ejzamefhuhflruozakji.supabase.co',
  process.env.SUPABASE_SECRET_KEY
)
module.exports = supabase