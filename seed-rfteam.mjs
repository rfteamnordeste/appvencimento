import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local manually
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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seed() {
  console.log('--- STARTING SEED & VERIFICATION ---');

  // 1. Create or get Academy
  let academyId;
  const { data: existingAcademies, error: acaFetchErr } = await supabase
    .from('academies')
    .select('*')
    .eq('name', 'RF Team');

  if (acaFetchErr) console.error('Error fetching academy:', acaFetchErr);

  if (existingAcademies && existingAcademies.length > 0) {
    academyId = existingAcademies[0].id;
    console.log('Existing RF Team Academy found:', existingAcademies[0].id);
  } else {
    const { data: newAcademy, error: acaErr } = await supabase
      .from('academies')
      .insert({
        name: 'RF Team',
        pix_key: 'rfteam.pix@gmail.com',
        timezone: 'America/Fortaleza'
      })
      .select()
      .single();

    if (acaErr) {
      console.error('Error creating academy:', acaErr);
      process.exit(1);
    }
    academyId = newAcademy.id;
    console.log('Created Academy RF Team:', newAcademy.id);
  }

  // 2. Create Auth User
  const email = 'professor@rfteam.com';
  const password = 'RFTeam2026!Password';

  let userId;
  const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing users:', listErr);
  }

  const existingUser = usersData?.users?.find(u => u.email === email);

  if (existingUser) {
    userId = existingUser.id;
    console.log('Existing User found in Auth:', existingUser.id, existingUser.email);
    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updateErr) console.error('Error updating user password:', updateErr);
    else console.log('Updated user password successfully.');
  } else {
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createErr) {
      console.error('Error creating user:', createErr);
      process.exit(1);
    }
    userId = newUser.user.id;
    console.log('Created Auth User:', userId, email);
  }

  // 3. Create or link profile
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingProfile) {
    console.log('Existing profile found:', existingProfile);
  } else {
    const { data: newProfile, error: profErr } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        academy_id: academyId,
        name: 'Professor Head Coach'
      })
      .select()
      .single();

    if (profErr) {
      console.error('Error creating profile:', profErr);
    } else {
      console.log('Created Profile:', newProfile);
    }
  }

  // 4. Create Message Templates
  const templates = [
    { reminder_type: 'd10', content: 'Olá {nome}! Seu vencimento da RF Team é em {dias} dias. Chave Pix: {pix_key}' },
    { reminder_type: 'd5', content: 'Olá {nome}! Faltam {dias} dias para o vencimento na RF Team. Chave Pix: {pix_key}' },
    { reminder_type: 'd0', content: 'Olá {nome}! Sua mensalidade da RF Team vence HOJE. Chave Pix: {pix_key}' }
  ];

  for (const t of templates) {
    const { data: existingT } = await supabase
      .from('message_templates')
      .select('*')
      .eq('academy_id', academyId)
      .eq('reminder_type', t.reminder_type)
      .maybeSingle();

    if (!existingT) {
      await supabase.from('message_templates').insert({
        academy_id: academyId,
        reminder_type: t.reminder_type,
        content: t.content,
        active: true
      });
      console.log(`Created template for ${t.reminder_type}`);
    }
  }

  // 5. Output Direct SELECT * FROM academies and SELECT * FROM profiles
  console.log('\n================ DATABASE QUERIES OUTPUT ================');
  const { data: academiesOutput } = await supabase.from('academies').select('*');
  console.log('SELECT * FROM academies;\n', JSON.stringify(academiesOutput, null, 2));

  const { data: profilesOutput } = await supabase.from('profiles').select('*');
  console.log('\nSELECT * FROM profiles;\n', JSON.stringify(profilesOutput, null, 2));
}

seed().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
