import sys
from collections import defaultdict

target = sys.argv[1]
mode = sys.argv[2] if len(sys.argv) > 2 else 'lines'
recs = open('coverage/lcov.info', encoding='utf-8').read().split('end_of_record')
for rec in recs:
    if target in rec.replace(chr(92), '/'):
        data = rec.strip().split('\n')
        print([l for l in data if l.startswith('SF')])
        print([l for l in data if l.startswith(('BRF', 'BRH', 'LF', 'LH'))])
        if mode == 'lines':
            uncov = [int(l[3:].split(',')[0]) for l in data if l.startswith('DA:') and l.endswith(',0')]
            ranges = []
            for n in uncov:
                if ranges and n == ranges[-1][1] + 1:
                    ranges[-1][1] = n
                else:
                    ranges.append([n, n])
            print('uncovered lines:', ', '.join(f'{a}-{b}' if a != b else str(a) for a, b in ranges))
        else:
            d = defaultdict(list)
            for l in data:
                if l.startswith('BRDA:'):
                    p = l[5:].split(',')
                    d[int(p[0])].append((p[1], p[2], p[3]))
            for ln in sorted(d):
                taken = d[ln]
                if any(t in ('0', '-') for _, _, t in taken):
                    print(ln, taken)
