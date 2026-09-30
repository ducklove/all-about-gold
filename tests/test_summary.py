import copy
import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path

from scripts import summary
from scripts import vc_publish as vp
from scripts.snapshot import validate

ROOT = Path(__file__).resolve().parents[1]
MONTH = re.compile(r'^\d{4}-\d{2}$')


def fixture():
    snapshot = summary.snapshot_from_exports(ROOT / 'data')
    snapshot['publishedAt'] = '2026-09-26T22:17:24.224637+00:00'
    return validate(snapshot)


def load_update_pages():
    spec = importlib.util.spec_from_file_location('update_pages', ROOT / 'ops/update_pages.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SummaryBuilderTests(unittest.TestCase):
    def test_payload_matches_the_hub_schema(self):
        data = summary.build_summary(fixture())
        # config/schemas/summary/all-about-gold.schema.json (value-invest): required keys.
        self.assertTrue({'publishedAt', 'prices', 'ratios', 'marketSize'} <= set(data))
        self.assertEqual([p['id'] for p in data['prices']], ['gold', 'silver', 'bitcoin', 'dollar', 'usdkrw'])
        for price in data['prices']:
            self.assertTrue({'id', 'name', 'unit', 'date', 'value'} <= set(price))
            self.assertRegex(price['date'], MONTH)
            self.assertRegex(price['prevDate'], MONTH)
        gold = data['prices'][0]
        self.assertEqual((gold['date'], gold['value'], gold['prevValue']), ('2026-08', 4411.0, 4073.0))
        self.assertEqual(gold['changePct'], round((4411 / 4073 - 1) * 100, 4))
        self.assertEqual(data['ratios'], {'date': '2026-08', 'goldSilver': round(4411 / 65.4, 4),
                                          'bitcoinGold': round(69487.215726 / 4411, 4)})
        market = data['marketSize']
        self.assertEqual((market['date'], market['aboveGroundTonnes'], market['miningTonnes']),
                         ('2025-12', 219891.0, 3300))
        self.assertIsInstance(market['marketCapUsd'], int)
        self.assertEqual(data['publishedAt'], '2026-09-26T22:17:24.224637+00:00')

    def test_month_over_month_change_needs_adjacent_months(self):
        snapshot = fixture()
        gold = next(a for a in snapshot['history']['assets'] if a['id'] == 'gold')
        del gold['points'][-2]  # 2026-06 -> 2026-08 is not month-over-month
        price = summary.build_summary(snapshot)['prices'][0]
        self.assertEqual(price['prevDate'], '2026-06')
        self.assertIsNone(price['changePct'])

    def test_envelope_is_valid_and_deterministic(self):
        envelope = summary.build_envelope(fixture())
        vp.validate_envelope(envelope)
        self.assertEqual((envelope['tool'], envelope['kind'], envelope['schemaVersion']),
                         ('all-about-gold', 'summary', 1))
        # asOf/generatedAt come from the finance-pi publication (KST), not the build clock.
        self.assertEqual(envelope['asOf'], '2026-09-27T07:17:24+09:00')
        self.assertEqual(envelope['generatedAt'], envelope['asOf'])
        self.assertEqual(vp.dumps_compact(envelope), vp.dumps_compact(summary.build_envelope(fixture())))
        self.assertLess(len(vp.dumps_compact(envelope)), 16 * 1024)

    def test_unchanged_content_is_not_rewritten(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp)
            self.assertTrue(summary.publish(fixture(), out))
            first = {name: (out / name).read_bytes() for name in ('summary.json', 'version.json')}
            self.assertFalse(summary.publish(fixture(), out))
            self.assertEqual({name: (out / name).read_bytes() for name in first}, first)
            version = json.loads(first['version.json'])
            self.assertEqual(version['files'], {'summary.json': json.loads(first['summary.json'])['contentHash']})
            changed = fixture()
            changed['history']['assets'][0]['points'][-1]['value'] = 4500.0
            self.assertTrue(summary.publish(changed, out))
            self.assertNotEqual((out / 'version.json').read_bytes(), first['version.json'])

    def test_committed_inspection_summary_is_current(self):
        committed = json.loads((ROOT / 'data/summary.json').read_text(encoding='utf-8'))
        vp.validate_envelope(committed)
        rebuilt = summary.build_envelope(validate(summary.snapshot_from_exports(ROOT / 'data')))
        self.assertEqual(committed['contentHash'], rebuilt['contentHash'],
                         'Regenerate: python3 scripts/summary.py --from-exports data --output data')
        version = json.loads((ROOT / 'data/version.json').read_text(encoding='utf-8'))
        self.assertEqual(version['files']['summary.json'], committed['contentHash'])


class FingerprintTests(unittest.TestCase):
    def test_ignores_run_timestamps_only(self):
        base = fixture()
        restamped = copy.deepcopy(base)
        restamped['publishedAt'] = '2026-09-28T22:17:00+00:00'
        for key in ('history', 'trends', 'marketSize'):
            restamped[key]['generatedAt'] = '2026-09-28T22:16:00+00:00'
        self.assertEqual(summary.fingerprint(base), summary.fingerprint(restamped))
        for mutate in (
            lambda s: s['history']['assets'][0]['points'][-1].update(value=4412.0),
            lambda s: s['research'].update(reviewedAt='2026-10-01'),
            lambda s: s['research']['supply'].update(publishedAt='2026-04-30'),
        ):
            changed = copy.deepcopy(base)
            mutate(changed)
            self.assertNotEqual(summary.fingerprint(base), summary.fingerprint(changed))


class DataBranchPublicationTests(unittest.TestCase):
    def test_timestamp_only_run_keeps_the_previous_publication(self):
        update_pages = load_update_pages()
        with tempfile.TemporaryDirectory() as temp:
            work = Path(temp)
            first = fixture()
            self.assertTrue(update_pages.stage_publication(work, first))
            published = (work / 'data/current.json').read_bytes()
            self.assertTrue((work / '.github/workflows/pages.yml').exists())

            restamped = copy.deepcopy(first)
            restamped['publishedAt'] = '2026-09-28T22:17:00+00:00'
            restamped['history']['generatedAt'] = '2026-09-28T22:16:00+00:00'
            self.assertFalse(update_pages.stage_publication(work, restamped))
            self.assertEqual((work / 'data/current.json').read_bytes(), published)

            restamped['history']['assets'][0]['points'][-1]['value'] = 4412.0
            self.assertTrue(update_pages.stage_publication(work, restamped))
            current = json.loads((work / 'data/current.json').read_text(encoding='utf-8'))
            self.assertEqual(current['publishedAt'], '2026-09-28T22:17:00+00:00')


if __name__ == '__main__':
    unittest.main()
