import copy
import json
import tempfile
import unittest
from pathlib import Path

from scripts import vc_publish as vp
from scripts.build_pages import build
from scripts.snapshot import validate

ROOT = Path(__file__).resolve().parents[1]


def fixture():
    return {
        'schemaVersion': 1, 'provider': 'finance-pi',
        'publishedAt': '2026-09-26T00:27:46+00:00',
        'marketSize': json.loads((ROOT / 'data/market_size.json').read_text()),
        **{key: json.loads((ROOT / 'data' / (key + '.json')).read_text())
           for key in ('history', 'trends', 'research')},
    }


class PagesTests(unittest.TestCase):
    def test_artifact_uses_relative_snapshot_and_only_public_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            snapshot = root / 'snapshot.json'
            snapshot.write_text(json.dumps(fixture()))
            site = root / 'site'
            build(snapshot, site)
            html = (site / 'index.html').read_text()
            self.assertIn('content="data/current.json"', html)
            self.assertNotIn('content="/api/gold"', html)
            self.assertEqual({p.name for p in site.iterdir()},
                             {'index.html', 'static', 'data', 'config.json', '.nojekyll',
                              'summary.json', 'version.json'})
            self.assertEqual(json.loads((site / 'data/current.json').read_text())['provider'],
                             'finance-pi')
            # Vendored Value Compass shell assets ship with the static tree.
            self.assertTrue((site / 'static/vc-shell.js').is_file())
            self.assertTrue((site / 'static/vc-tokens.css').is_file())
            envelope = vp.validate_envelope(json.loads((site / 'summary.json').read_text()))
            self.assertEqual(envelope['tool'], 'all-about-gold')
            self.assertEqual(envelope['asOf'], '2026-09-26T09:27:46+09:00')
            self.assertEqual(json.loads((site / 'version.json').read_text())['files'],
                             {'summary.json': envelope['contentHash']})
            # Rebuilding the same publication yields byte-identical hub files.
            before = (site / 'summary.json').read_bytes(), (site / 'version.json').read_bytes()
            build(snapshot, site)
            self.assertEqual(((site / 'summary.json').read_bytes(), (site / 'version.json').read_bytes()),
                             before)

    def test_invalid_or_incomplete_generation_is_rejected(self):
        valid = fixture()
        for mutate in (
            lambda s: s.update(provider='other'),
            lambda s: s.pop('marketSize'),
            lambda s: s['marketSize']['goldDebtRatioPct'][-1].update(value=9999),
            lambda s: s['marketSize']['marketCap'][-1].update(value=1),
            lambda s: s['history']['assets'].pop(),
            lambda s: s['trends']['reserves'].pop(),
            lambda s: s['history']['assets'][0]['points'][0].update(value=float('nan')),
        ):
            broken = copy.deepcopy(valid)
            mutate(broken)
            with self.assertRaises(ValueError):
                validate(broken)
