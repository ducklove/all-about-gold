"""Build an allowlisted Pages artifact using a finance-pi snapshot."""
import argparse
import json
import shutil
from pathlib import Path

try:
    from . import summary
    from .snapshot import read
except ImportError:
    import summary
    from snapshot import read

ROOT = Path(__file__).resolve().parents[1]


def build(snapshot_path, output):
    snapshot = read(snapshot_path)
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    marker = '<meta name="gold-data-url" content="/api/gold">'
    if marker not in html:
        raise ValueError('Missing explicit data endpoint')
    (output / 'index.html').write_text(
        html.replace(marker, '<meta name="gold-data-url" content="data/current.json">'),
        encoding='utf-8',
    )
    shutil.copytree(ROOT / 'static', output / 'static', dirs_exist_ok=True)
    (output / 'data').mkdir(exist_ok=True)
    (output / 'data/current.json').write_text(
        json.dumps(snapshot, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8'
    )
    config = json.loads((ROOT / 'config.json').read_text())
    config['dataApi'] = 'data/current.json'
    config['delivery'] = 'published-finance-pi-snapshot'
    (output / 'config.json').write_text(json.dumps(config, indent=2) + '\n')
    # Value Compass hub card: <site>/summary.json + version.json (data contract §4).
    summary.publish(snapshot, output)
    (output / '.nojekyll').touch()
    print('Pages artifact:', output, 'finance-pi publication:', snapshot['publishedAt'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / '_site')
    args = parser.parse_args()
    build(args.snapshot, args.output)
