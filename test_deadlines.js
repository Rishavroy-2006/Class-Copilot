require('dotenv').config({ path: 'dashboard/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('deadlines')
    .select('*');
    
  console.log("Deadlines Data length:", data?.length);
  if (data?.length > 0) {
     console.log("First row chat_id:", data[0].chat_id);
     console.log("Match exactly?:", data[0].chat_id === '120363412429875166@g.us');
  }
  if (error) console.error("Error:", error);
}
test();
