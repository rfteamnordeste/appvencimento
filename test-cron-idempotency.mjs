import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envConfig = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envConfig.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = envVars.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function testCron() {
  console.log('--- ITEM 7: PRODUCTION CRON IDEMPOTENCY TEST (GET) ---');

  // Fetch RF Team
  const { data: aca } = await supabaseAdmin.from('academies').select('*').eq('name', 'RF Team').single();
  
  // Set student due_day to match target reminder (e.g., 10 days from today)
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + 10);
  const dueDay10 = targetDate.getDate();

  // Find or update active student
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('academy_id', aca.id)
    .eq('status', 'active')
    .limit(1)
    .single();

  console.log(`Setting student "${student.name}" due_day to ${dueDay10} (10 days from today)...`);
  await supabaseAdmin.from('students').update({ due_day: dueDay10 }).eq('id', student.id);

  // Clear existing reminder_logs & billing_cycles for clean idempotency test
  await supabaseAdmin.from('reminder_logs').delete().eq('student_id', student.id);
  await supabaseAdmin.from('billing_cycles').delete().eq('student_id', student.id);

  const cronUrl = 'https://rfteam.vercel.app/api/cron/daily';

  console.log('\n[RUN 1] Calling GET https://rfteam.vercel.app/api/cron/daily ...');
  const res1 = await fetch(cronUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${cronSecret}`
    }
  });

  const text1 = await res1.text();
  console.log('Status 1:', res1.status);
  console.log('RAW JSON RESPONSE RUN 1:\n', text1);

  console.log('\n[RUN 2 - SAME DAY RE-RUN] Calling GET https://rfteam.vercel.app/api/cron/daily ...');
  const res2 = await fetch(cronUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${cronSecret}`
    }
  });

  const text2 = await res2.text();
  console.log('Status 2:', res2.status);
  console.log('RAW JSON RESPONSE RUN 2:\n', text2);
}

testCron().catch(console.error);
