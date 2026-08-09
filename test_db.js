const supabase = require('./supabaseClient');

async function test() {
  const { data } = await supabase.from('past_papers').select('id, subject, chat_id');
  console.log(data);
}
test();
