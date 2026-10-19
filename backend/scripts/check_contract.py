#!/usr/bin/env python3
"""Static API coverage and source synchronization, not a replacement for integration tests."""
from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET
try:
    import yaml
except ImportError:
    sys.exit("Установите PyYAML: python3 -m pip install pyyaml")

root = Path(__file__).resolve().parents[1]
contract = yaml.safe_load((root / 'contracts/openapi.yaml').read_text())
expected = {(m.upper(), p) for p, item in contract['paths'].items()
            for m in item if m in {'get', 'post', 'patch', 'delete', 'put'}}
actual = set()
for source in (root / 'src/main/java/ru/dvizh/api').glob('*Controller.java'):
    text = source.read_text()
    prefix = re.search(r'@RequestMapping\("([^"]+)"\)', text).group(1)
    for method, path in re.findall(r'@(Get|Post|Patch|Delete|Put)Mapping\("([^"]+)"\)', text):
        full = prefix + path
        assert full.startswith('/api/v1'), full
        entry = (method.upper(), full[len('/api/v1'):])
        assert entry not in actual, f'Duplicate mapping: {entry}'
        actual.add(entry)
assert expected == actual, f'Missing={expected-actual}; Extra={actual-expected}'
resources = root / 'src/main/resources'
assert (root / 'contracts/openapi.yaml').read_bytes() == (resources / 'static/openapi.yaml').read_bytes()
assert json.loads((resources / 'api-schemas.json').read_text()) == contract['components']['schemas']
api = (root / 'src/main/java/ru/dvizh/api/Api.java').read_text()
for name, schema in contract['components']['schemas'].items():
    if schema.get('type') == 'string' and 'enum' in schema:
        support_names = {'SupportCategory': 'Category', 'SupportStatus': 'Status', 'SupportPriority': 'Priority', 'SupportReportReason': 'ReportReason'}
        source = (root / 'src/main/java/ru/dvizh/api/SupportApi.java').read_text() if name in support_names else api
        values = re.search(r'public enum ' + support_names.get(name, name) + r' \{ ([^}]+) \}', source).group(1)
        assert [v.strip() for v in values.split(',')] == schema['enum'], name
ET.parse(root / 'pom.xml')
yaml.safe_load((root / 'compose.yaml').read_text())
for file in resources.glob('application*.yml'):
    yaml.safe_load(file.read_text())
print(f'OK: {len(expected)} operations match OpenAPI; enums, schema resources, pom.xml and YAML are consistent.')
