import os, sqlite3
from datetime import datetime, timezone
from pathlib import Path
os.umask(0o077)
root=Path('/var/backups/egg-jianghu-cloud')
root.mkdir(parents=True,exist_ok=True)
path=root / (datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')+'.sqlite')
with sqlite3.connect('/var/lib/egg-jianghu-cloud/cloud.sqlite') as src, sqlite3.connect(path) as dst:
    src.backup(dst)
for old in sorted(root.glob('*.sqlite'))[:-7]:
    old.unlink()
