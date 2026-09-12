import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch
from PIL import Image

sys.path.insert(0, str(Path.cwd() / 'tools'))
spec = importlib.util.spec_from_file_location('converter', 'tools/convert-images-to-webp.py')
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)
with tempfile.TemporaryDirectory(prefix='blogger-round4-supervisor-') as directory:
    root = Path(directory)
    posts = root / 'source' / '_posts'
    images = root / 'source' / 'images'
    posts.mkdir(parents=True)
    images.mkdir()
    Image.new('RGB', (16, 12), 'red').save(images / 'first.png')
    (images / 'bad.png').write_bytes(b'not a real image')
    post = posts / 'one.md'
    raw = b'---\ntitle: One\n---\n<img src="/images/first.png">\n<img src="/images/bad.png">\n'
    post.write_bytes(raw)
    with contextlib.redirect_stderr(io.StringIO()):
        try:
            converter.main(['--post', str(post), '--write'], root=root)
            raise AssertionError('corrupt second image must fail')
        except SystemExit as error:
            assert error.code == 2
    assert post.read_bytes() == raw
    assert not (images / 'first.webp').exists()
    post.write_bytes(raw.replace(b'<img src="/images/bad.png">\n', b''))
    before = post.read_bytes()
    with patch.object(converter, 'plan_reference_updates', side_effect=PermissionError('fixture text plan failure')):
        with contextlib.redirect_stderr(io.StringIO()):
            try:
                converter.main(['--post', str(post), '--write'], root=root)
                raise AssertionError('text plan failure must fail')
            except SystemExit as error:
                assert error.code == 2
    assert post.read_bytes() == before
    assert not (images / 'first.webp').exists()
    with contextlib.redirect_stdout(io.StringIO()):
        converter.main(['--post', str(post), '--write'], root=root)
    snapshots = {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in root.rglob('*') if p.is_file()}
    with contextlib.redirect_stdout(io.StringIO()):
        converter.main(['--post', str(post), '--write'], root=root)
    for p, (data, mtime) in snapshots.items():
        assert p.read_bytes() == data and p.stat().st_mtime_ns == mtime, p
print('PASS supervisor fixtures: corrupt later image and text planning failure cause zero writes; repeat conversion preserves bytes and mtimes')
