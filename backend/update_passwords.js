const bcrypt = require('bcrypt');
const supabase = require('./services/supabase');

async function updatePasswords() {
  const hash = bcrypt.hashSync('dept@1234', 10);
  console.log('New hash generated:', hash);

  const { data, error } = await supabase
    .from('departments')
    .update({ password_hash: hash })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to update all

  if (error) {
    console.error('Failed to update passwords:', error);
  } else {
    console.log('Passwords successfully updated to dept@1234 for all departments!');
  }
  process.exit(0);
}

updatePasswords();
