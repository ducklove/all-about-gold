"""Export a finance-pi snapshot for inspection; never call upstream vendors here."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen


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
    for key in ('history', 'trends', 'research'):
        temp = root / (key + '.tmp')
        temp.write_text(json.dumps(snapshot[key], ensure_ascii=False) + '\n', encoding='utf-8')
        os.replace(temp, root / (key + '.json'))
    print('Exported finance-pi snapshot', snapshot['publishedAt'])


if __name__ == '__main__':
    main()
