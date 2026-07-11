import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data } = await supabase.from('events').select('id, title').limit(1)
  console.log('EVENT_DATA:', JSON.stringify(data))
}
run()
