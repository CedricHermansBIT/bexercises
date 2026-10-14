// Extract explicitly labelled starter blocks without changing solutions or tests.
// Run without --save to review; --save backs up, adds the column and updates metadata.
const path=require('node:path');
const fs=require('node:fs/promises');
const sqlite3=require('sqlite3');
const {open}=require('sqlite');
const {extractDescriptionStarter}=require('../services/exerciseStarterService');
async function main() {
 const db=await open({filename:path.join(__dirname,'../../data/exercises.db'),driver:sqlite3.Database});
 try {
  const rows=await db.all('SELECT * FROM exercises ORDER BY id');
  const changes=rows.filter(row=>row.starter_code==null).map(row=>({row,change:extractDescriptionStarter(row.description)})).filter(entry=>entry.change);
  console.log(JSON.stringify({exercises:changes.length,ids:changes.map(entry=>entry.row.id)}));
  if(!process.argv.includes('--save'))return;
  const directory=await fs.mkdtemp(path.join(__dirname,'../../data/exercise-starter-backup-'));
  await fs.chmod(directory,0o700);
  const backup=path.join(directory,'exercises.db');await db.run('VACUUM INTO ?',backup);await fs.chmod(backup,0o600);
  await db.exec('PRAGMA busy_timeout=10000; BEGIN IMMEDIATE');
  try {
   const columns=await db.all('PRAGMA table_info(exercises)');
   if(!columns.some(column=>column.name==='starter_code'))await db.exec('ALTER TABLE exercises ADD COLUMN starter_code TEXT');
   for(const {row,change} of changes) {
    const updated=await db.run('UPDATE exercises SET starter_code=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND description=? AND starter_code IS NULL',change.starter_code,change.description,row.id,row.description);
    if(updated.changes!==1)throw new Error(`Exercise changed during migration: ${row.id}`);
   }
   await db.exec('COMMIT');
  }catch(error){await db.exec('ROLLBACK');throw error;}
  console.log(JSON.stringify({migrated:changes.length,backup,serverRestartRequired:true}));
 }finally{await db.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={main};
