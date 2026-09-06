"""Export one garage from an administrator-provided legacy SQLite backup.
Never fetches hosted data or writes to the source database.
"""
import argparse, json, pathlib, re, shutil, sqlite3, os
parser=argparse.ArgumentParser()
parser.add_argument('--database',required=True)
parser.add_argument('--legacy-owner',required=True)
parser.add_argument('--photos-directory')
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
keys=set()
for record in records:
 for dino in [record,*record.get('dinosaurs',{}).values()]:
  photo=dino.get('photo','')
  if photo:
   key=photo.removeprefix('/api/photos/')
   if not re.fullmatch(r'[a-f0-9-]{36}',key): raise SystemExit('Unexpected screenshot key')
   keys.add(key)
sources={}
for key in keys:
 if not args.photos_directory: raise SystemExit('Private object backup required for this garage')
 root=pathlib.Path(args.photos_directory).resolve()
 source=(root/args.legacy_owner/key).resolve()
 if not source.is_relative_to(root) or not source.is_file(): raise SystemExit('Missing private screenshot in backup')
 sources[key]=source
out=pathlib.Path(args.output).resolve()
out.mkdir(mode=0o700,parents=False,exist_ok=False)
(out/'photos').mkdir(mode=0o700)
for key,source in sources.items():
 target=out/'photos'/key
 shutil.copyfile(source,target);os.chmod(target,0o600)
manifest={'format':1,'legacyOwnerId':args.legacy_owner,'garage':dict(garage),'shares':shares}
(out/'manifest.json').write_text(json.dumps(manifest))
os.chmod(out/'manifest.json',0o600)
print('One owner exported. Store this private backup securely.')
