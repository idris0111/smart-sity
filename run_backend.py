"""Run Django with bundled Python when the old virtualenv launcher is broken."""
import runpy
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
sys.path[:0] = [str(root), str(root / '.venv' / 'Lib' / 'site-packages')]
sys.argv[0] = str(root / 'manage.py')
runpy.run_path(sys.argv[0], run_name='__main__')
