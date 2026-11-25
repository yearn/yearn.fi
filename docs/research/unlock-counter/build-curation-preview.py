"""Build the integrated curation review with embedded data and no network dependencies."""
import json
from pathlib import Path

base = Path(__file__).parent
page = (base / 'curation.html').read_text()
script = (base / 'curation-report.mjs').read_text()
start = script.index('const response = await fetch(')
end = script.index('const time = new Intl.DateTimeFormat(', start)
script = script[:start] + 'const data = JSON.parse(document.querySelector("#pilot-data").textContent);\n' + script[end:]
data = json.dumps(json.loads((base / 'curation-pilot-depositor-value.json').read_text()), separators=(',', ':')).replace('<', '\\u003c')
script_tag = '<script type="module" src="curation-report.mjs?v=2"></script>'
assert script_tag in page
page = page.replace(script_tag, '<script id="pilot-data" type="application/json">' + data + '</script><script type="module">' + script + '</script>')
(base / 'curation-preview.html').write_text(page)
print('Self-contained curation review generated.')
