const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

async function run() {
  const db = createClient({ url: 'file:data/cowbox.db' });
  const hash = bcrypt.hashSync('password123', 10);
  await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE email = ?',
    args: [hash, 'admin@email.com']
  });
  console.log('Reset OK, actual hash:', hash);
}

run();
