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

const supabaseAdmin = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function callProductionEndpoint() {
  console.log('--- PRODUCTION HTTP ENDPOINT EXECUTION ---');

  // Prepare student due_day to match 10 days from today
  const { data: aca } = await supabaseAdmin.from('academies').select('*').eq('name', 'RF Team').single();
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + 10);
  const dueDay10 = targetDate.getDate();

  const { data: student } = await supabaseAdmin.from('students').select('*').eq('academy_id', aca.id).eq('status', 'active').limit(1).single();
  await supabaseAdmin.from('students').update({ due_day: dueDay10 }).eq('id', student.id);
  
  // Clear reminder logs for clean test
  await supabaseAdmin.from('reminder_logs').delete().eq('student_id', student.id);
  await supabaseAdmin.from('billing_cycles').delete().eq('student_id', student.id);

  const endpointUrl = 'https://rfteam.vercel.app/api/cron/daily';
  const authHeader = 'Bearer rfteam_cron_secret_2024_secure_key_x9k2p';

  // Wait a few seconds to ensure Vercel finished deployment
  console.log('Waiting 10s for Vercel deployment sync...');
  await new Promise(r => setTimeout(r, 10000));

  console.log(`\n[RUN 1] Calling GET ${endpointUrl}`);
  const res1 = await fetch(endpointUrl, {
    method: 'GET',
    headers: { 'Authorization': authHeader }
  });
  const body1 = await res1.text();
  console.log(`HTTP STATUS RUN 1: ${res1.status} ${res1.statusText}`);
  console.log(`RAW RESPONSE BODY RUN 1:\n${body1}`);

  console.log(`\n[RUN 2 - SAME DAY RE-RUN] Calling GET ${endpointUrl}`);
  const res2 = await fetch(endpointUrl, {
    method: 'GET',
    headers: { 'Authorization': authHeader }
  });
  const body2 = await res2.text();
  console.log(`HTTP STATUS RUN 2: ${res2.status} ${res2.statusText}`);
  console.log(`RAW RESPONSE BODY RUN 2:\n${body2}`);
}

callProductionEndpoint().catch(console.error);
