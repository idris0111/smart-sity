"""Optional management/module launcher. Run with the project's virtualenv Python."""
import runpy
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
sys.path.insert(0, str(root))
if len(sys.argv) > 2 and sys.argv[1] == '--module':
    module = sys.argv[2]
    sys.argv = [module, *sys.argv[3:]]
    runpy.run_module(module, run_name='__main__')
    sys.exit()
sys.argv[0] = str(root / 'manage.py')
runpy.run_path(sys.argv[0], run_name='__main__')
