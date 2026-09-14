"""Demo for the grain check gates. Not part of the product; this PR is closed unmerged."""

import requests


def fetch(url: str) -> str:
    resp = requests.get(url, verify=False, timeout=10)
    resp.raise_for_status()
    return resp.text
