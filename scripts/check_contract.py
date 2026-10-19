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
for source in (root / 'backend/src/main/java/ru/dvizh/api').glob('*Controller.java'):
    text = source.read_text()
    prefix = re.search(r'@RequestMapping\("([^"]+)"\)', text).group(1)
    for method, path in re.findall(r'@(Get|Post|Patch|Delete|Put)Mapping\("([^"]+)"\)', text):
        full = prefix + path
        assert full.startswith('/api/v1'), full
        entry = (method.upper(), full[len('/api/v1'):])
        assert entry not in actual, f'Duplicate mapping: {entry}'
        actual.add(entry)
assert expected == actual, f'Missing={expected-actual}; Extra={actual-expected}'
resources = root / 'backend/src/main/resources'
assert (root / 'contracts/openapi.yaml').read_bytes() == (resources / 'static/openapi.yaml').read_bytes()
assert json.loads((resources / 'api-schemas.json').read_text()) == contract['components']['schemas']
api = (root / 'backend/src/main/java/ru/dvizh/api/Api.java').read_text()
for name, schema in contract['components']['schemas'].items():
    if schema.get('type') == 'string' and 'enum' in schema:
        values = re.search(r'public enum ' + name + r' \{ ([^}]+) \}', api).group(1)
        assert [v.strip() for v in values.split(',')] == schema['enum'], name
ET.parse(root / 'backend/pom.xml')
yaml.safe_load((root / 'compose.yaml').read_text())
for file in resources.glob('application*.yml'):
    yaml.safe_load(file.read_text())
print(f'OK: {len(expected)} operations match OpenAPI; enums, schema resources, pom.xml and YAML are consistent.')
