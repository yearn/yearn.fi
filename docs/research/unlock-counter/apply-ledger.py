"""Run the existing Yearn Data ownership engine without database access or writes."""
import argparse
import hashlib
import importlib
import json
import pathlib
import subprocess
import sys
from decimal import Decimal, localcontext, ROUND_FLOOR

parser = argparse.ArgumentParser()
parser.add_argument('--metrics-source', required=True)
args = parser.parse_args()
source = pathlib.Path(args.metrics_source).resolve()
sys.path.insert(0, str(source / 'src'))
account = importlib.import_module('yearn_data.tvl').account
frames = json.load(sys.stdin)
results = []
for frame in frames:
    rows, edges, diagnostics = account(frame['rows'], frame['positions'], include_curation=True,
        require_complete_ownership=True)
    with localcontext() as context:
        context.prec = 78
        for edge in edges:
            value = edge.get('overlap_usd')
            owned = edge.get('owned_usd')
            edge['allocated_shares_raw'] = None if value is None else str(
                int((Decimal(edge['balance_raw']) * Decimal(value) / Decimal(owned)).to_integral_value(rounding=ROUND_FLOOR))
            ) if owned is not None and Decimal(owned) > 0 else '0'
    results.append({'timestamp': frame['timestamp'], 'rows': rows, 'positions': edges, 'diagnostics': diagnostics})
engine = source / 'src/yearn_data/tvl.py'
metadata = {'engine': 'yearn_data.tvl.account', 'engineSha256': hashlib.sha256(engine.read_bytes()).hexdigest(),
    'sourceCommit': subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()}
json.dump({'engine': metadata, 'frames': results}, sys.stdout)
