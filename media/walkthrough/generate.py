# -*- coding: utf-8 -*-
"""Generates walkthrough SVG mockups (dark + light) for the Alya extension.

Run: python3 media/walkthrough/generate.py
Design system: gradient glow backdrop, rounded window, traffic lights,
one focal visual per step, minimal text. Keep this script: it regenerates
the artwork (like social-card.html does). Excluded from the vsix.
"""
import os
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))

DARK = {
    'bg': '#0b0d17', 'chrome': '#141928', 'fg': '#cbd5e1', 'dim': '#64748b',
    'kw': '#c084fc', 'str': '#34d399', 'fn': '#38bdf8', 'accent': '#38bdf8',
    'check': '#34d399', 'hl': '#1e3a5f66', 'line': '#232c47', 'num': '#3b4763',
    'glow1': 'rgba(139,92,246,0.20)', 'glow2': 'rgba(56,189,248,0.16)',
}
LIGHT = {
    'bg': '#eef2f7', 'chrome': '#ffffff', 'fg': '#1e293b', 'dim': '#64748b',
    'kw': '#7c3aed', 'str': '#047857', 'fn': '#0369a1', 'accent': '#0284c7',
    'check': '#059669', 'hl': '#bae6fd', 'line': '#dbe3ee', 'num': '#94a3b8',
    'glow1': 'rgba(124,58,237,0.10)', 'glow2': 'rgba(2,132,199,0.10)',
}
FONT = "Consolas, 'Courier New', monospace"
W = 480


def defs(uid):
    return (
        '<defs>'
        '<radialGradient id="g1%s" cx="88%%" cy="8%%" r="55%%">'
        '<stop offset="0%%" stop-color="GLOW1"/><stop offset="100%%" stop-color="GLOW1T"/>'
        '</radialGradient>'
        '<radialGradient id="g2%s" cx="8%%" cy="95%%" r="60%%">'
        '<stop offset="0%%" stop-color="GLOW2"/><stop offset="100%%" stop-color="GLOW2T"/>'
        '</radialGradient>'
        '<linearGradient id="acc%s" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="ACC"/><stop offset="1" stop-color="ACC2"/>'
        '</linearGradient>'
        '</defs>' % (uid, uid, uid)).replace('GLOW1T', 'transparent').replace(
            'GLOW2T', 'transparent')


def window_open(pal, uid, title, h):
    dots = ''.join(
        '<circle cx="%d" cy="15" r="5" fill="%s"/>' % (22 + k * 18, c)
        for k, c in enumerate(['#f87171', '#fbbf24', '#34d399']))
    return (
        '<rect x="0.5" y="0.5" width="479" height="%d" rx="12" fill="%s"/>' % (h - 1, pal['bg'])
        + '<rect x="0.5" y="0.5" width="479" height="%d" rx="12" fill="url(#g1%s)"/>' % (h - 1, uid)
        + '<rect x="0.5" y="0.5" width="479" height="%d" rx="12" fill="url(#g2%s)"/>' % (h - 1, uid)
        + '<rect x="0.5" y="0.5" width="479" height="%d" rx="12" fill="none" stroke="%s"/>' % (h - 1, pal['line'])
        + '<line x1="1" y1="30" x2="479" y2="30" stroke="%s"/>' % pal['line']
        + dots
        + '<text x="70" y="20" font-family="%s" font-size="12" fill="%s">%s</text>'
        % (FONT, pal['dim'], escape(title)))


def text_row(y, segs, x=28, size=14, anchor=None):
    parts = ['<tspan fill="%s">%s</tspan>' % (c, escape(t)) for t, c in segs]
    a = ' text-anchor="%s"' % anchor if anchor else ''
    return ('<text x="%d" y="%d"%s font-family="%s" font-size="%d">%s</text>'
            % (x, y, a, FONT, size, ''.join(parts)))


def doc(pal, uid, title, h, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
            'viewBox="0 0 %d %d">%s%s%s</svg>'
            % (W, h, W, h, defs(uid).replace('GLOW1', pal['glow1']).replace(
                'GLOW2', pal['glow2']).replace('ACC', pal['accent']).replace(
                'ACC2', pal['fn']), window_open(pal, uid, title, h), body))


def step1(pal):
    b = text_row(92, [('$ ', pal['dim']), ('alya --version', pal['fg'])], size=15)
    b += text_row(122, [('alya 0.0.19', pal['str'])], size=15)
    b += ('<rect x="24" y="140" width="11" height="20" rx="2" fill="%s"/>'
          % pal['accent'])
    b += text_row(200, [('windows-x86_64  •  ready', pal['dim'])], size=12)
    return doc(pal, 's1', 'Terminal', 240, b)


def step2(pal):
    y = 66
    b = text_row(y, [('▾ my-project', pal['dim'])])
    y += 30
    b += ('<rect x="0.5" y="%d" width="3" height="30" fill="%s"/>'
          % (y - 22, pal['accent']))
    b += ('<rect x="12" y="%d" width="456" height="30" rx="7" fill="%s"/>'
          % (y - 22, pal['hl']))
    b += ('<circle cx="46" cy="%d" r="5" fill="%s"/>' % (y - 7, pal['accent']))
    b += text_row(y, [('hello.alya', pal['fg'])], x=62)
    for name, kind, dy in (('main.alya', 'alya', 32), ('notes.txt', 'txt', 32),
                           ('tests', 'dir', 32)):
        y += dy
        if kind == 'dir':
            b += text_row(y, [('▸ tests', pal['dim'])], x=36)
        else:
            dot = pal['accent'] if kind == 'alya' else pal['dim']
            b += '<circle cx="46" cy="%d" r="5" fill="none" stroke="%s" stroke-width="1.5"/>' % (y - 5, dot)
            b += text_row(y, [(name, pal['dim'])], x=62)
    return doc(pal, 's2', 'Explorer', 250, b)


def step3(pal):
    play = ('<rect x="28" y="150" width="118" height="34" rx="17" fill="ACCX"/>'
            '<text x="52" y="173" font-family="%s" font-size="14" fill="#ffffff">▶ Run</text>'
            % FONT).replace('ACCX', pal['accent'])
    b = text_row(80, [('say ', pal['kw']), ('"Hello, Alya!"', pal['str'])],
                 size=16)
    b += text_row(118, [('{2 + 2}  →  ', pal['dim']), ('4', pal['fn'])], size=16)
    b += play
    b += text_row(173, [('Hello, Alya!   exit 0', pal['dim'])], x=162, size=12)
    return doc(pal, 's3', 'hello.alya', 230, b.replace(
        'fill="url(#accs3)"', 'fill="url(#accs3)"'))


def step4(pal):
    dots = [('✓', pal['check']), ('✓', pal['check'])]
    b = text_row(70, [('Bracket palette', pal['dim'])], size=12)
    cols = ['#38bdf8', '#c084fc', '#34d399', '#818cf8', '#e0f2fe', '#a855f7']
    if pal['bg'] == '#eef2f7':
        cols = ['#0284c7', '#7c3aed', '#059669', '#4f46e5', '#0369a1', '#a21caf']
    for i, c in enumerate(cols):
        b += '<circle cx="%d" cy="96" r="11" fill="%s"/>' % (44 + i * 34, c)
    b += text_row(140, [('✓ ', pal['check']), ('Alya Dark', pal['fg'])])
    b += text_row(168, [('✓ ', pal['check']), ('12 passed', pal['fg'])])
    b += text_row(196, [('Σ  0.42s', pal['dim'])], size=12)
    return doc(pal, 's4', 'Setup', 230, b)


def step5(pal):
    b = ('<circle cx="240" cy="82" r="30" fill="none" stroke="url(#accs5)" '
         'stroke-width="4"/>')
    b += ('<text x="240" y="94" text-anchor="middle" font-family="%s" font-size="32" '
          'font-weight="bold" fill="%s">A</text>' % (FONT, pal['fg']))
    b += text_row(140, [('Write  •  Run  •  Test', pal['dim'])], x=240,
                  size=12, anchor='middle')
    for i, label in enumerate(('Docs', 'Issues')):
        y = 158 + i * 36
        b += ('<rect x="175" y="%d" width="130" height="28" rx="14" fill="none" '
              'stroke="%s" stroke-width="1.5"/>' % (y, pal['accent']))
        b += text_row(y + 19, [(label + '  ▸', pal['accent'])], x=240, size=13,
                      anchor='middle')
    return doc(pal, 's5', 'Alya', 232, b)


STEPS = {'step1-terminal': step1, 'step2-file': step2, 'step3-run': step3,
         'step4-theme': step4, 'step5-docs': step5}

for name, fn in STEPS.items():
    for variant, pal in (('dark', DARK), ('light', LIGHT)):
        path = os.path.join(HERE, '%s-%s.svg' % (name, variant))
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(fn(pal))
        print(path)
