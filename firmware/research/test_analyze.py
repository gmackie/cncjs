import unittest
from analyze import ROOT, inspect, parse_hex


def record(address, kind, data=b''):
    body = bytes([len(data)]) + address.to_bytes(2, 'big') + bytes([kind]) + data
    return ':' + (body + bytes([-sum(body) % 256])).hex()


EOF = record(0, 1)


class HexTests(unittest.TestCase):
    def test_actual_artifacts(self):
        paths = list((ROOT / 'artifacts').glob('*.hex'))
        self.assertEqual(len(paths), 3)
        for path in paths:
            result = inspect(path)
            self.assertEqual(result['first_address'], 0)
            self.assertEqual(result['holes'], 0)

    def test_corrupt_checksum(self):
        with self.assertRaises(ValueError):
            parse_hex(':010000004100\n' + EOF)

    def test_truncated_missing_eof_and_trailing_records(self):
        valid = record(0, 0, b'ABC')
        for text in (valid[:-2], valid, valid + '\n' + EOF + '\n' + valid, '<html>404</html>'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_hex(text)

    def test_overlap(self):
        with self.assertRaises(ValueError):
            parse_hex('\n'.join([record(0, 0, b'A')] * 2 + [EOF]))

    def test_extended_addresses(self):
        for kind, expected in ((2, 16), (4, 65536)):
            self.assertEqual(parse_hex('\n'.join([record(0, kind, b'\x00\x01'), record(0, 0, b'A'), EOF])), {expected: 65})


if __name__ == '__main__':
    unittest.main()
