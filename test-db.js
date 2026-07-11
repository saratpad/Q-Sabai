import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
async function test() {
  // Test insert WITHOUT select
  const { data, error, status } = await supabase.from('bookings').insert({
    event_id: '3e40d3dd-655b-43bf-aa81-2c55f77816a2',
    user_id: null,
    field_responses: {},
    status: 'waiting',
    queue_number: 0
  }) // NO SELECT!
  console.log('Status without select:', status)
  console.log('Insert Error without select:', error)
}
test()
