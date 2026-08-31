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

async function updateTemplates() {
  const { data: aca } = await supabaseAdmin.from('academies').select('*').eq('name', 'RF Team').single();
  
  const templates = [
    {
      academy_id: aca.id,
      reminder_type: 'd10',
      content: '🥋 Fala, {{nome}}! Passando pra lembrar que sua mensalidade da {{academia}} vence em {{dias}} dias ({{data_vencimento}}). Se quiser adiantar, nossa chave Pix é {{chave_pix}}. Bora pro treino! 💪',
      active: true
    },
    {
      academy_id: aca.id,
      reminder_type: 'd5',
      content: '🥋 Fala, {{nome}}! Sua mensalidade vence em {{dias}} dias ({{data_vencimento}}). Chave Pix pra facilitar: {{chave_pix}}. Qualquer coisa, é só chamar. Oss! 👊',
      active: true
    },
    {
      academy_id: aca.id,
      reminder_type: 'd0',
      content: '🥋 Fala, {{nome}}! Hoje é o vencimento da sua mensalidade no valor de {{valor}}. Chave Pix da {{academia}}: {{chave_pix}}. Quando puder, dá aquela conferida. Valeu por fazer parte do time! Oss! 🦏',
      active: true
    }
  ];

  for (const t of templates) {
    await supabaseAdmin.from('message_templates').upsert(t, { onConflict: 'academy_id,reminder_type' });
  }

  console.log('\n================ SELECT * FROM message_templates; ================');
  const { data: result } = await supabaseAdmin.from('message_templates').select('*');
  console.log(JSON.stringify(result, null, 2));
}

updateTemplates().catch(console.error);
