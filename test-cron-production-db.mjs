import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const envConfig = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envConfig.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// DEFAULT TEMPLATES FALLBACK
const DEFAULT_TEMPLATES = {
  d10: 'Olá {nome}! Seu vencimento na RF Team é em {dias} dias ({data}). Valor: R$ {valor}. Chave PIX: {pix_key}',
  d5: 'Olá {nome}! Lembrete: seu vencimento na RF Team é em {dias} dias ({data}). Valor: R$ {valor}. Chave PIX: {pix_key}',
  d0: 'Olá {nome}! Seu vencimento na RF Team é HOJE ({data}). Valor: R$ {valor}. Chave PIX: {pix_key}',
};

function getDaysUntilDue(dueDay, timezone) {
  const nowInTz = toZonedTime(new Date(), timezone);
  const todayDate = nowInTz.getDate();

  let days = dueDay - todayDate;
  if (days < 0) {
    const lastDayOfMonth = new Date(nowInTz.getFullYear(), nowInTz.getMonth() + 1, 0).getDate();
    days = (lastDayOfMonth - todayDate) + dueDay;
  }
  return days;
}

function getReminderTypeForToday(daysUntilDue) {
  if (daysUntilDue === 10) return 'd10';
  if (daysUntilDue === 5) return 'd5';
  if (daysUntilDue === 0) return 'd0';
  return null;
}

function getNextDueDate(dueDay, timezone) {
  const nowInTz = toZonedTime(new Date(), timezone);
  const currentMonth = nowInTz.getMonth();
  const currentYear = nowInTz.getFullYear();
  const todayDate = nowInTz.getDate();

  let targetMonth = currentMonth;
  let targetYear = currentYear;

  if (dueDay < todayDate) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const actualDueDay = Math.min(dueDay, lastDayOfTargetMonth);

  return new Date(targetYear, targetMonth, actualDueDay);
}

function buildCycleKey(academyId, studentId, dueDate) {
  const dateStr = format(dueDate, 'yyyy-MM-dd');
  return `${academyId}_${studentId}_${dateStr}`;
}

async function runCronCycle(runName) {
  console.log(`\n====================================================`);
  console.log(`EXECUTION: ${runName}`);
  console.log(`====================================================`);

  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    reminders_created: 0,
  };

  const { data: academies } = await supabase.from('academies').select('*');
  
  for (const academy of academies) {
    const timezone = academy.timezone || 'America/Fortaleza';
    const nowInTz = toZonedTime(new Date(), timezone);
    const today = format(nowInTz, 'yyyy-MM-dd');

    const { data: templates } = await supabase
      .from('message_templates')
      .select('*')
      .eq('academy_id', academy.id)
      .eq('active', true);

    const templateMap = {
      d10: templates?.find(t => t.reminder_type === 'd10')?.content || DEFAULT_TEMPLATES.d10,
      d5: templates?.find(t => t.reminder_type === 'd5')?.content || DEFAULT_TEMPLATES.d5,
      d0: templates?.find(t => t.reminder_type === 'd0')?.content || DEFAULT_TEMPLATES.d0,
    };

    const { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('academy_id', academy.id)
      .eq('status', 'active');

    if (!students || students.length === 0) continue;

    for (const student of students) {
      results.processed++;

      const daysUntilDue = getDaysUntilDue(student.due_day, timezone);
      const reminderType = getReminderTypeForToday(daysUntilDue);

      if (!reminderType) {
        results.skipped++;
        continue;
      }

      const dueDate = getNextDueDate(student.due_day, timezone);
      const cycleKey = buildCycleKey(academy.id, student.id, dueDate);

      // IDEMPOTENCY CHECK
      const { data: existingLog } = await supabase
        .from('reminder_logs')
        .select('id, status')
        .eq('student_id', student.id)
        .eq('reminder_type', reminderType)
        .eq('scheduled_for', today)
        .in('status', ['sent', 'pending'])
        .maybeSingle();

      if (existingLog) {
        results.skipped++;
        console.log(`[IDEMPOTENCY MATCH] Student ${student.name} already has reminder log (${existingLog.id}, status: ${existingLog.status}). SKIPPING!`);
        continue;
      }

      const dueDateStr = format(dueDate, 'yyyy-MM-dd');
      await supabase.from('billing_cycles').upsert(
        { student_id: student.id, due_date: dueDateStr, cycle_key: cycleKey },
        { onConflict: 'cycle_key', ignoreDuplicates: true }
      );

      const { data: cycle } = await supabase
        .from('billing_cycles')
        .select('id')
        .eq('cycle_key', cycleKey)
        .single();

      const template = templateMap[reminderType];
      const message = template
        .replace('{nome}', student.name)
        .replace('{dias}', String(daysUntilDue))
        .replace('{pix_key}', academy.pix_key);

      const cleanPhone = student.phone_e164.replace(/\+/g, '');
      const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

      const { error: insertError } = await supabase.from('reminder_logs').insert({
        student_id: student.id,
        billing_cycle_id: cycle?.id || null,
        reminder_type: reminderType,
        scheduled_for: today,
        status: 'pending',
        channel: 'whatsapp_link',
        wa_link: waLink,
        message_text: message,
      });

      if (insertError) {
        results.errors++;
      } else {
        results.reminders_created++;
      }
    }
  }

  const output = {
    ...results,
    timestamp: new Date().toISOString(),
    message: `Cron executado com sucesso. ${results.reminders_created} lembretes criados.`
  };

  console.log('JSON RESPONSE:\n', JSON.stringify(output, null, 2));
  return output;
}

async function main() {
  // 1. Prepare student to match 10 days from today
  const { data: aca } = await supabase.from('academies').select('*').eq('name', 'RF Team').single();
  const todayInTz = toZonedTime(new Date(), 'America/Fortaleza');
  const targetDate = new Date(todayInTz);
  targetDate.setDate(todayInTz.getDate() + 10);
  const dueDay10 = targetDate.getDate();

  const { data: student } = await supabase.from('students').select('*').eq('academy_id', aca.id).eq('status', 'active').limit(1).single();
  await supabase.from('students').update({ due_day: dueDay10 }).eq('id', student.id);
  
  // Clear logs for clean test
  await supabase.from('reminder_logs').delete().eq('student_id', student.id);
  await supabase.from('billing_cycles').delete().eq('student_id', student.id);

  console.log(`Configured student "${student.name}" due_day to ${dueDay10} (10 days from today).`);

  // RUN 1
  await runCronCycle('RUN 1 (FIRST EXECUTION OF THE DAY)');

  // RUN 2 (SAME DAY)
  await runCronCycle('RUN 2 (SECOND EXECUTION ON SAME DAY - IDEMPOTENCY VERIFICATION)');
}

main().catch(console.error);
