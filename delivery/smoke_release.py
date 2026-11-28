#!/usr/bin/env python3
"""Release smoke test: web, DB-backed health, SHA, reading public posts."""
import json
import sys
import time
from urllib.request import urlopen


def check(base, sha):
    paths = ['/', '/api/health', '/api/version', '/api/v1/posts']
    for path in paths:
        for attempt in range(12):
            try:
                with urlopen(base + path, timeout=5) as r:
                    body = r.read(2_000_000)
                    assert r.status == 200
                    if path == '/':
                        assert b'<html' in body.lower() or b'<!doctype' in body.lower()
                    elif path == '/api/health':
                        assert json.loads(body)['database'] == 'ok'
                    elif path == '/api/version':
                        assert json.loads(body)['version'] == sha
                    elif path == '/api/v1/posts':
                        assert isinstance(json.loads(body), list)
                print('OK:', path)
                break
            except Exception as e:
                if attempt == 11:
                    raise RuntimeError(f'{path} failed: {e}') from e
                time.sleep(2)


if __name__ == '__main__':
    if len(sys.argv) != 3 or not (len(sys.argv[2]) == 40 and all(c in '0123456789abcdef' for c in sys.argv[2])):
        sys.exit('Usage: smoke_release.py http://127.0.0.1:8088 SHA40')
    check(sys.argv[1].rstrip('/'), sys.argv[2])
