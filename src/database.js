const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://ejzamefhuhflruozakji.supabase.co',
  'sb_publishable_A7sERtkW4sQ8lX1fd88OSg_riHWYvxK'
)

module.exports = supabase