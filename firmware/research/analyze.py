#!/usr/bin/env python3
"""Offline Intel HEX validation and firmware inventory. Never accesses hardware."""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent


def parse_hex(text):
    memory, base, ended = {}, 0, False
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        if ended or not line.startswith(':'):
            raise ValueError(f'line {number}: unexpected record')
        try:
            record = bytes.fromhex(line[1:])
        except ValueError as exc:
            raise ValueError(f'line {number}: invalid hexadecimal') from exc
        if len(record) < 5 or len(record) != record[0] + 5 or sum(record) % 256:
            raise ValueError(f'line {number}: bad length/checksum')
        address = int.from_bytes(record[1:3], 'big')
        kind, data = record[3], record[4:-1]
        if kind == 0:
            if address + len(data) > 65536:
                raise ValueError('record crosses address boundary')
            for offset, value in enumerate(data):
                target = base + address + offset
                if target in memory:
                    raise ValueError('overlapping data records')
                memory[target] = value
        elif kind == 1 and not data and address == 0:
            ended = True
        elif kind in (2, 4) and len(data) == 2 and address == 0:
            base = int.from_bytes(data, 'big') << (4 if kind == 2 else 16)
        elif kind in (3, 5) and len(data) == 4 and address == 0:
            pass  # Start address metadata does not contribute flash bytes.
        else:
            raise ValueError(f'line {number}: invalid/unsupported record type {kind}')
    if not ended or not memory:
        raise ValueError('missing EOF or empty image')
    return memory


def inspect(path):
    raw = path.read_bytes()
    memory = parse_hex(raw.decode('ascii'))
    low, high = min(memory), max(memory)
    if high >= 32768:
        raise ValueError(f'{path.name}: exceeds ATmega328P flash')
    image = bytes(memory.get(address, 255) for address in range(low, high + 1))
    strings = [match.group().decode('ascii') for match in re.finditer(rb'[ -~]{6,}', image)]
    return {
        'file': str(path.relative_to(ROOT)),
        'file_sha256': hashlib.sha256(raw).hexdigest(),
        'image_sha256': hashlib.sha256(image).hexdigest(),
        'populated_bytes': len(memory), 'first_address': low, 'last_address': high,
        'holes': len(image) - len(memory),
        'identity_strings': [s for s in strings if any(x in s for x in ('Grbl', '1.1', '2017', '2019'))],
    }


def main():
    report = [inspect(path) for path in sorted((ROOT / 'artifacts').glob('*.hex'))]
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
