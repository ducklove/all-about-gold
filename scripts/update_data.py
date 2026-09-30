"""Export a finance-pi snapshot for inspection; never call upstream vendors here."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

try:
    from . import summary
except ImportError:
    import summary


def main():
    base = os.environ.get('FINANCE_PI_BASE_URL', 'http://127.0.0.1:8401').rstrip('/')
    headers = {'Accept': 'application/json'}
    if os.environ.get('FINANCE_PI_ADMIN_TOKEN'):
        headers['X-Admin-Token'] = os.environ['FINANCE_PI_ADMIN_TOKEN']
    with urlopen(Request(base + '/api/research/gold', headers=headers), timeout=30) as response:
        snapshot = json.load(response)
    if snapshot.get('provider') != 'finance-pi':
        raise ValueError('Unexpected provider')
    root = Path(__file__).resolve().parents[1] / 'data'
    root.mkdir(exist_ok=True)
    for key, name in [('history', 'history'), ('trends', 'trends'),
                      ('research', 'research'), ('marketSize', 'market_size')]:
        temp = root / (name + '.tmp')
        temp.write_text(json.dumps(snapshot[key], ensure_ascii=False) + '\n', encoding='utf-8')
        os.replace(temp, root / (name + '.json'))
    # Same summary the Pages build publishes, kept next to the exports for inspection.
    summary.publish(snapshot, root)
    print('Exported finance-pi snapshot', snapshot['publishedAt'])


if __name__ == '__main__':
    main()
