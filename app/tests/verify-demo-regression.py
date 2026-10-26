"""Run the unchanged public-demo checks with isolated project-local evidence.

The original harness hardcodes port 8000 and a pre-existing review directory.
Only those two output/runtime paths are substituted; assertions stay unchanged.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import os

project = Path(__file__).resolve().parents[2]
evidence = project / os.environ.get('COURSE_PLANNER_REVIEW_DIR', 'app/reviews/saved-calendar-phase1/existing-demo')
evidence.mkdir(parents=True, exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(project)))
threading.Thread(target=server.serve_forever, daemon=True).start()
source_path = project / 'tests/verify_demo.py'
source = source_path.read_text()
old_output = "out=Path(__file__).resolve().parents[1]/'docs/reviews/interactive-demo-2026-10-20'"
assert old_output in source, 'Review upstream harness output path before running'
source = source.replace(old_output, 'out=Path(' + repr(str(evidence)) + ')')
source = source.replace('http://127.0.0.1:8000/', f'http://127.0.0.1:{server.server_address[1]}/')
try:
    exec(compile(source, str(source_path), 'exec'), {'__file__': str(source_path), '__name__': '__main__'})
finally:
    server.shutdown()
    server.server_close()
