"""Run on finance-pi: collect, read its API, validate, then publish the data branch."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from snapshot import validate  # noqa: E402


def run(*args, cwd=None, check=True):
    return subprocess.run(args, cwd=cwd, check=check)


def main():
    pi = Path(os.environ.get('FINANCE_PI_ROOT', str(ROOT.parent / 'finance-pi')))
    run(str(pi / '.venv/bin/python'), '-m', 'finance_pi.research.gold', '--root', str(pi), cwd=pi)
    base = os.environ.get('FINANCE_PI_BASE_URL', 'http://127.0.0.1:8400').rstrip('/')
    headers = {'Accept': 'application/json'}
    if os.environ.get('FINANCE_PI_ADMIN_TOKEN'):
        headers['X-Admin-Token'] = os.environ['FINANCE_PI_ADMIN_TOKEN']
    with urlopen(Request(base + '/api/research/gold', headers=headers), timeout=30) as response:
        payload = response.read(8_000_001)
    if len(payload) > 8_000_000:
        raise ValueError('Oversized finance-pi snapshot')
    snapshot = validate(json.loads(payload))
    published = datetime.fromisoformat(snapshot['publishedAt'].replace('Z', '+00:00'))
    age = (datetime.now(timezone.utc) - published).total_seconds()
    if age < -300 or age > 3600:
        raise ValueError('finance-pi API did not serve the newly collected generation')
    remote = os.environ.get('GOLD_PUBLISH_REMOTE', 'git@github.com:ducklove/all-about-gold.git')
    with tempfile.TemporaryDirectory(prefix='gold-pages-') as directory:
        work = Path(directory)
        run('git', 'init', '-q', '-b', 'data', str(work))
        run('git', 'remote', 'add', 'origin', remote, cwd=work)
        exists = run('git', 'ls-remote', '--exit-code', '--heads', 'origin', 'data', cwd=work, check=False)
        if exists.returncode == 0:
            run('git', 'fetch', '--depth=1', 'origin', 'data', cwd=work)
            run('git', 'checkout', '-q', '-B', 'data', 'FETCH_HEAD', cwd=work)
        elif exists.returncode != 2:
            raise RuntimeError('Cannot verify remote data branch')
        (work / 'data').mkdir(exist_ok=True)
        (work / 'data/current.json').write_text(
            json.dumps(snapshot, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8'
        )
        # Push events read workflows from the pushed branch, so data carries the
        # reviewed Pages workflow too. The workflow always checks out main.
        workflows = work / '.github/workflows'
        workflows.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / '.github/workflows/pages.yml', workflows / 'pages.yml')
        run('git', 'config', 'user.name', 'finance-pi publisher', cwd=work)
        run('git', 'config', 'user.email', 'finance-pi@users.noreply.github.com', cwd=work)
        run('git', 'add', 'data/current.json', '.github/workflows/pages.yml', cwd=work)
        changed = run('git', 'diff', '--cached', '--quiet', cwd=work, check=False)
        if changed.returncode == 0:
            print('Snapshot unchanged')
            return
        if changed.returncode != 1:
            raise RuntimeError('Cannot inspect snapshot change')
        run('git', 'commit', '-q', '-m', 'Publish finance-pi gold snapshot ' + snapshot['publishedAt'], cwd=work)
        run('git', 'push', 'origin', 'HEAD:refs/heads/data', cwd=work)
    print('Published complete finance-pi snapshot:', snapshot['publishedAt'])


if __name__ == '__main__':
    main()
