import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  host: 'db.wtsdqfdvbhjqwoivbpvr.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'RF.Team123@123',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function main() {
  console.log('Connecting to Supabase PostgreSQL...');
  await client.connect();
  console.log('Connected!\n');

  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '001_initial.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running migration...');
  try {
    await client.query(sql);
    console.log('Migration executed successfully!\n');
  } catch (err) {
    // Some "already exists" errors are expected on re-runs
    if (err.message && (err.message.includes('already exists') || err.message.includes('duplicate'))) {
      console.log('Note (non-fatal): ' + err.message.substring(0, 150));
    } else {
      console.error('Migration error:', err.message);
      // Try individual statements
      console.log('\nRetrying statement by statement...');
      const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 5 && !s.startsWith('--'));
      let errors = 0;
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          await client.query(stmt);
          console.log(`  [OK] Statement ${i+1}/${statements.length}`);
        } catch (e) {
          if (e.message.includes('already exists') || e.message.includes('duplicate')) {
            console.log(`  [SKIP] Statement ${i+1}: ${e.message.substring(0, 80)}`);
          } else {
            console.log(`  [ERR] Statement ${i+1}: ${e.message.substring(0, 150)}`);
            errors++;
          }
        }
      }
      console.log(`\nDone. ${errors} real errors.`);
    }
  }

  // Verify RLS policies
  console.log('\n=== Verifying RLS Policies ===');
  const policies = await client.query(`
    SELECT tablename, policyname, cmd 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    ORDER BY tablename, policyname;
  `);
  console.log(`Found ${policies.rows.length} RLS policies:`);
  policies.rows.forEach(r => {
    console.log(`  ${r.tablename}.${r.policyname} [${r.cmd}]`);
  });

  // Verify tables exist
  console.log('\n=== Tables Created ===');
  const tables = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
  `);
  tables.rows.forEach(r => console.log('  ' + r.tablename));

  await client.end();
  console.log('\nDone!');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
