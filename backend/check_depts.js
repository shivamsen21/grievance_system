const bcrypt = require('bcrypt');
const supabase = require('./services/supabase');

async function checkDepts() {
  console.log('\n=== Checking departments table ===\n');

  const { data: depts, error } = await supabase
    .from('departments')
    .select('id, name, email, password_hash');

  if (error) {
    console.error('❌ Error fetching departments:', error.message);
    process.exit(1);
  }

  if (!depts || depts.length === 0) {
    console.log('❌ NO DEPARTMENTS FOUND IN DATABASE — table is empty!');
    process.exit(0);
  }

  console.log(`✅ Found ${depts.length} department(s):\n`);

  const testPassword = 'dept@1234';
  for (const d of depts) {
    const valid = d.password_hash ? await bcrypt.compare(testPassword, d.password_hash) : false;
    console.log(`  Name:  ${d.name}`);
    console.log(`  Email: ${d.email}`);
    console.log(`  Hash:  ${d.password_hash ? d.password_hash.slice(0, 20) + '...' : '❌ NULL / MISSING'}`);
    console.log(`  Password "dept@1234" valid: ${valid ? '✅ YES' : '❌ NO'}`);
    console.log('');
  }
  process.exit(0);
}

checkDepts();
