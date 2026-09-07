"""Export one garage from an administrator-provided legacy SQLite backup.
Never fetches hosted data or writes to the source database.
"""
import argparse, json, pathlib, sqlite3, os
parser=argparse.ArgumentParser()
parser.add_argument('--database',required=True)
parser.add_argument('--legacy-owner',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
database=pathlib.Path(args.database).resolve()
connection=sqlite3.connect(database.as_uri()+'?mode=ro',uri=True)
connection.row_factory=sqlite3.Row
garage=connection.execute('SELECT * FROM garages WHERE owner_id=?',(args.legacy_owner,)).fetchone()
if garage is None: raise SystemExit('Owner not found in this backup')
shares=[dict(row) for row in connection.execute('SELECT * FROM shares WHERE owner_id=?',(args.legacy_owner,))]
raw=json.loads(garage['records'])
records=raw if isinstance(raw,list) else raw['servers']
for record in records:
 for dino in [record,*record.get('dinosaurs',{}).values()]:
  dino['photo']=''
exported_garage=dict(garage)
exported_garage['records']=json.dumps(raw)
for share in shares: share['include_photos']=0
out=pathlib.Path(args.output).resolve()
out.mkdir(mode=0o700,parents=False,exist_ok=False)
manifest={'format':1,'legacyOwnerId':args.legacy_owner,'garage':exported_garage,'shares':shares}
(out/'manifest.json').write_text(json.dumps(manifest))
os.chmod(out/'manifest.json',0o600)
print('One owner exported. Store this private backup securely.')
