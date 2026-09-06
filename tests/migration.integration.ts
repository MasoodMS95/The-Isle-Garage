import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {Pool} from 'pg';
assert.ok(['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname));
const folder='outputs/migration-test-'+Date.now();await mkdir(folder);
const owner='migration-'+randomUUID(),share=randomUUID().replaceAll('-','');
const seed=String.raw`
import sqlite3,json,sys
db=sqlite3.connect(sys.argv[1])
db.executescript("CREATE TABLE garages(owner_id TEXT,records TEXT,version INTEGER,updated_at TEXT); CREATE TABLE shares(id TEXT,owner_id TEXT,title TEXT,selected_ids TEXT,include_codes INTEGER,include_photos INTEGER,active INTEGER,updated_at TEXT,discord_status TEXT,next_attempt INTEGER);")
r=dict(id="server",name="Legacy",community="Test",kind="Custom",favorite=True,state="Living",species="Tyrannosaurus",growth=100,photo="",code="")
db.execute("INSERT INTO garages VALUES(?,?,1,?)",("old-owner",json.dumps([r]),"2026-01-01T00:00:00.000Z"))
db.execute("INSERT INTO garages VALUES(?,?,1,?)",("other-private-owner","[]","2026-01-01T00:00:00.000Z"))
db.execute("INSERT INTO shares VALUES(?,?,?,?,0,0,1,?,'not_configured',0)",(sys.argv[2],"old-owner","Legacy profile",'["server"]',"2026-01-01T00:00:00.000Z"))
db.commit()
`;
assert.equal(spawnSync('python3',['-c',seed,folder+'/backup.sqlite',share]).status,0);
assert.equal(spawnSync('python3',['scripts/export-legacy.py','--database',folder+'/backup.sqlite','--legacy-owner','old-owner','--output',folder+'/export']).status,0);
const manifest=await readFile(folder+'/export/manifest.json','utf8');assert.ok(!manifest.includes('other-private-owner'));
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try{
 await pool.query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,NOW(),NOW())',[owner,'Migration test',owner+'@example.test']);
 const args=['--import','tsx','scripts/import-legacy.ts','--directory',folder+'/export','--legacy-owner','old-owner','--new-owner',owner,'--confirm-owner-map'];
 const imported=spawnSync(process.execPath,args,{env:process.env,encoding:'utf8'});assert.equal(imported.status,0,imported.stderr);
 const row=(await pool.query('SELECT records FROM garages WHERE owner_id=$1',[owner])).rows[0];assert.equal(JSON.parse(row.records).servers[0].growth,100);
 assert.equal((await pool.query('SELECT owner_id FROM shares WHERE id=$1',[share])).rows[0].owner_id,owner);
 assert.notEqual(spawnSync(process.execPath,args,{env:process.env}).status,0);
 console.log('PASS: owner-scoped read-only export, verified explicit import, record/share retention and overwrite refusal.');
}finally{await pool.end();}
