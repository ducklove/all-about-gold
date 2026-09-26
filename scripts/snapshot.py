"""Shared validation for finance-pi snapshots published to the static site."""
import json
import math
from datetime import datetime
from pathlib import Path


def validate(snapshot):
    if snapshot.get('provider') != 'finance-pi' or snapshot.get('schemaVersion') != 1:
        raise ValueError('Unsupported finance-pi snapshot')
    published = datetime.fromisoformat(snapshot['publishedAt'].replace('Z', '+00:00'))
    if published.tzinfo is None:
        raise ValueError('Publication timestamp must include a timezone')
    history = snapshot['history']
    if history['schemaVersion'] != 2:
        raise ValueError('Unsupported history schema')
    assets = {asset['id']: asset for asset in history['assets']}
    if set(assets) != {'gold', 'silver', 'bitcoin', 'dollar', 'usdkrw'}:
        raise ValueError('Incomplete price series')
    series = list(assets.values()) + snapshot['trends']['mining'] + snapshot['trends']['reserves']
    if len(snapshot['trends']['mining']) != 2 or len(snapshot['trends']['reserves']) != 6:
        raise ValueError('Incomplete mining/reserve history')
    for item in series:
        points = item['points']
        if len(points) < 20:
            raise ValueError('Insufficient historical coverage')
        dates = [point['date'] for point in points]
        if dates != sorted(set(dates)):
            raise ValueError('Duplicate or unsorted observations')
        for point in points:
            datetime.strptime(point['date'], '%Y-%m')
            value = point['value']
            if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError('Invalid observation')
            if item in assets.values() and value == 0:
                raise ValueError('Zero price')
    if assets['gold']['points'][0]['date'] != '1960-01':
        raise ValueError('Long gold history is missing')
    for key in ('supply', 'mining', 'reserves', 'etfs', 'reviewedAt'):
        if not snapshot['research'].get(key):
            raise ValueError('Incomplete reviewed research')
    validate_market_size(snapshot)
    return snapshot


def read(path):
    return validate(json.loads(Path(path).read_text(encoding='utf-8')))


def validate_market_size(snapshot):
    market = snapshot.get('marketSize')
    if not market or market.get('schemaVersion') != 1:
        raise ValueError('Missing market-size research')
    keys = ('stock', 'mining', 'marketCap', 'usDebt', 'goldDebtRatioPct',
            'miningStockRatioPct', 'stockToFlowYears')
    maps = {}
    for key in keys:
        points = market.get(key, [])
        dates = [p['date'] for p in points]
        if len(points) < 20 or dates != sorted(set(dates)):
            raise ValueError('Incomplete annual market-size observations')
        for point in points:
            datetime.strptime(point['date'], '%Y-%m')
            if (not point['date'].endswith('-12') or not math.isfinite(point['value'])
                    or point['value'] <= 0):
                raise ValueError('Invalid annual market-size observation')
        maps[key] = {p['date']: p['value'] for p in points}
    prices = next(a for a in snapshot['history']['assets'] if a['id'] == 'gold')
    prices = {p['date']: p['value'] for p in prices['points']}
    anchor = market['inputs']['stockAnchor']
    if maps['stock'].get(str(anchor['year'])+'-12') != anchor['tonnes']:
        raise ValueError('Invalid stock anchor')
    if set(maps['goldDebtRatioPct']) != set(maps['marketCap']) & set(maps['usDebt']):
        raise ValueError('Gold/debt dates must intersect')
    for date, cap in maps['marketCap'].items():
        expected = maps['stock'][date] * 1_000_000 / 31.1034768 * prices[date]
        if not math.isclose(cap, expected, rel_tol=1e-8):
            raise ValueError('Incorrect gold value conversion')
    for date, ratio in maps['goldDebtRatioPct'].items():
        if not math.isclose(ratio, maps['marketCap'][date] / maps['usDebt'][date] * 100, rel_tol=1e-8):
            raise ValueError('Incorrect gold/debt ratio')
    for date, ratio in maps['miningStockRatioPct'].items():
        if not math.isclose(ratio, maps['mining'][date] / maps['stock'][date] * 100, rel_tol=1e-8):
            raise ValueError('Incorrect mining/stock ratio')
        if not math.isclose(maps['stockToFlowYears'][date] * ratio, 100, rel_tol=1e-8):
            raise ValueError('Incorrect stock/flow inverse')
