"""Value Compass summary.json/version.json for the hub's '금 투자 리서치' card.

Contract: value-invest docs/ecosystem/data-contract.md §6.9 and
config/schemas/summary/all-about-gold.schema.json. The envelope helper
(vc_publish.py) is vendored by value-invest scripts/sync-ecosystem.mjs; do not
edit it here.

The summary is derived only from a validated finance-pi snapshot, so the same
publication always yields byte-identical files: asOf and generatedAt are the
finance-pi ``publishedAt`` (KST), never the build time.
"""
import argparse
import json
from datetime import datetime
from pathlib import Path

try:
    from . import vc_publish as vp
except ImportError:
    import vc_publish as vp

TOOL = 'all-about-gold'
PRICE_IDS = ('gold', 'silver', 'bitcoin', 'dollar', 'usdkrw')
SOURCES = (
    {'id': 'finance-pi', 'name': 'finance-pi 금 리서치 발행본'},
    {'id': 'worldbank', 'name': 'World Bank Pink Sheet',
     'url': 'https://www.worldbank.org/en/research/commodity-markets'},
    {'id': 'yahoo', 'name': 'Yahoo Finance', 'url': 'https://finance.yahoo.com/'},
    {'id': 'wgc', 'name': 'World Gold Council', 'url': 'https://www.gold.org/'},
    {'id': 'usgs', 'name': 'USGS', 'url': 'https://www.usgs.gov/'},
    {'id': 'us-treasury', 'name': 'U.S. Treasury Debt to the Penny',
     'url': 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/'},
)
# Timestamps finance-pi stamps on every collection run. They say when a run
# happened, not what the data is, so they are left out of the content fingerprint.
VOLATILE_TOP = ('publishedAt',)
VOLATILE_SECTION = ('generatedAt',)


def _round(value, digits):
    return round(value, digits) if isinstance(value, (int, float)) else None


def _previous_month(month):
    year, number = int(month[:4]), int(month[5:7])
    return f'{year - 1}-12' if number == 1 else f'{year}-{number - 1:02d}'


def _price(asset):
    points = asset.get('points') or []
    latest = points[-1]
    previous = points[-2] if len(points) > 1 else None
    change = None
    # Month-over-month only for adjacent months, like the overview cards.
    if previous and previous['date'] == _previous_month(latest['date']) and previous['value']:
        change = _round((latest['value'] / previous['value'] - 1) * 100, 4)
    return {
        'id': asset['id'], 'name': asset['name'], 'unit': asset.get('unit'),
        'date': latest['date'], 'value': latest['value'],
        'prevDate': previous['date'] if previous else None,
        'prevValue': previous['value'] if previous else None,
        'changePct': change,
    }


def _last(series):
    return series[-1] if series else {}


def build_summary(snapshot):
    """Return the §6.9 ``data`` payload from a validated finance-pi snapshot."""
    assets = {asset['id']: asset for asset in snapshot['history']['assets']}
    prices = [_price(assets[key]) for key in PRICE_IDS if assets.get(key, {}).get('points')]
    by_id = {price['id']: price for price in prices}
    gold, silver, bitcoin = by_id.get('gold'), by_id.get('silver'), by_id.get('bitcoin')

    def same_month_ratio(numerator, denominator):
        if not numerator or not denominator or numerator['date'] != denominator['date']:
            return None
        return _round(numerator['value'] / denominator['value'], 4)

    market = snapshot.get('marketSize') or {}
    stock = _last(market.get('stock'))
    cap = _last(market.get('marketCap'))
    return {
        'publishedAt': snapshot.get('publishedAt'),
        'prices': prices,
        'ratios': {
            'date': gold['date'] if gold else None,
            'goldSilver': same_month_ratio(gold, silver),
            'bitcoinGold': same_month_ratio(bitcoin, gold),
        },
        'marketSize': {
            'date': stock.get('date'),
            'aboveGroundTonnes': stock.get('value'),
            'miningTonnes': _last(market.get('mining')).get('value'),
            'marketCapUsd': round(cap['value']) if isinstance(cap.get('value'), (int, float)) else None,
            'goldDebtRatioPct': _round(_last(market.get('goldDebtRatioPct')).get('value'), 4),
            'stockToFlowYears': _round(_last(market.get('stockToFlowYears')).get('value'), 4),
        },
    }


def _published_at(snapshot):
    published = datetime.fromisoformat(snapshot['publishedAt'].replace('Z', '+00:00'))
    return published.replace(microsecond=0)


def build_envelope(snapshot):
    published = _published_at(snapshot)
    return vp.build_envelope(TOOL, build_summary(snapshot), as_of=published,
                             generated_at=published, sources=list(SOURCES))


def publish(snapshot, directory):
    """Write summary.json and version.json into ``directory``; True when summary changed."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    envelope = build_envelope(snapshot)
    changed = vp.write_if_changed(directory / 'summary.json', envelope)
    vp.write_version(directory / 'version.json', {'summary.json': envelope},
                     generated_at=envelope['generatedAt'])
    return changed


def fingerprint(snapshot):
    """Content hash of a finance-pi snapshot without its run timestamps."""
    stable = {}
    for key, value in snapshot.items():
        if key in VOLATILE_TOP:
            continue
        if isinstance(value, dict):
            value = {k: v for k, v in value.items() if k not in VOLATILE_SECTION}
        stable[key] = value
    return vp.content_hash(stable)


def snapshot_from_exports(directory):
    """Rebuild a snapshot from the inspection exports in data/ (offline).

    The exports do not keep ``publishedAt``; the latest section ``generatedAt``
    stands in for it.
    """
    directory = Path(directory)
    sections = {key: json.loads((directory / (name + '.json')).read_text(encoding='utf-8'))
                for key, name in (('history', 'history'), ('trends', 'trends'),
                                  ('research', 'research'), ('marketSize', 'market_size'))}
    stamps = [datetime.fromisoformat(s['generatedAt'].replace('Z', '+00:00'))
              for s in sections.values() if isinstance(s, dict) and s.get('generatedAt')]
    return {'schemaVersion': 1, 'provider': 'finance-pi',
            'publishedAt': max(stamps).isoformat(), **sections}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--snapshot', type=Path, help='finance-pi snapshot (current.json)')
    source.add_argument('--from-exports', type=Path, help='directory with the data/*.json exports')
    parser.add_argument('--output', type=Path, required=True, help='directory for summary.json/version.json')
    args = parser.parse_args()
    try:
        from .snapshot import read, validate
    except ImportError:
        from snapshot import read, validate
    snap = read(args.snapshot) if args.snapshot else validate(snapshot_from_exports(args.from_exports))
    print('summary.json', 'written' if publish(snap, args.output) else 'unchanged', '->', args.output)
