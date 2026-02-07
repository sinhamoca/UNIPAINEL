import db from './config/database.js';
await db.initDatabase();
console.log('DB init OK');
console.log('run type:', typeof db.run);
console.log('get type:', typeof db.get);
console.log('all type:', typeof db.all);
try {
  const result = db.all('SELECT * FROM playlist_domains LIMIT 1');
  console.log('Query result:', result);
} catch(e) {
  console.log('Error:', e.message);
}
process.exit(0);
