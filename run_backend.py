"""Run Django with bundled Python when the old virtualenv launcher is broken."""
import runpy
import sys
import os
from pathlib import Path

root = Path(__file__).resolve().parent
# The bundled pgAdmin interpreter has unrelated optional packages. Use only
# project packages while keeping its Python standard library.
sys.path = [path for path in sys.path if 'site-packages' not in path.lower()]
sys.path[:0] = [str(root), str(root / '.venv' / 'Lib' / 'site-packages')]
env_file = root / '.env'
if env_file.exists():
    for line in env_file.read_text(encoding='utf-8').splitlines():
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ.setdefault(key, value)
if len(sys.argv) > 2 and sys.argv[1] == '--module':
    module = sys.argv[2]
    sys.argv = [module, *sys.argv[3:]]
    runpy.run_module(module, run_name='__main__')
    sys.exit()
sys.argv[0] = str(root / 'manage.py')
runpy.run_path(sys.argv[0], run_name='__main__')
