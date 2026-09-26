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
    return snapshot


def read(path):
    return validate(json.loads(Path(path).read_text(encoding='utf-8')))
