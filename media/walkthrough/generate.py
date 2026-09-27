# -*- coding: utf-8 -*-
"""Generates walkthrough SVG mockups (dark + light) for the Alya extension.

Run: python3 media/walkthrough/generate.py
Keep this script: it regenerates the artwork (like social-card.html does).
Excluded from the packaged vsix via .vscodeignore.
"""
import os
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))

DARK = {
    'bg': '#0e1322', 'chrome': '#141928', 'fg': '#cbd5e1', 'dim': '#64748b',
    'kw': '#c084fc', 'str': '#34d399', 'fn': '#38bdf8', 'accent': '#38bdf8',
    'check': '#34d399', 'hl': '#1e3a5f88', 'line': '#1c2742', 'num': '#3b4763',
}
LIGHT = {
    'bg': '#f8fafc', 'chrome': '#f1f5f9', 'fg': '#1e293b', 'dim': '#64748b',
    'kw': '#7c3aed', 'str': '#047857', 'fn': '#0369a1', 'accent': '#0284c7',
    'check': '#059669', 'hl': '#bae6fd', 'line': '#e2e8f0', 'num': '#94a3b8',
}
FONT = "Consolas, 'Courier New', monospace"
W = 480


def text_row(y, segs, x=24, size=13, anchor=None):
    parts = []
    for t, c in segs:
        parts.append('<tspan fill="%s">%s</tspan>' % (c, escape(t)))
    a = ' text-anchor="%s"' % anchor if anchor else ''
    return ('<text x="%d" y="%d"%s font-family="%s" font-size="%d">%s</text>'
            % (x, y, a, FONT, size, ''.join(parts)))


def window(pal, title, body, h=300):
    dots = ''.join(
        '<circle cx="%d" cy="14" r="5" fill="%s"/>' % (20 + k * 18, c)
        for k, c in enumerate(['#f87171', '#fbbf24', '#34d399']))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">'
        '<rect x="0.5" y="0.5" width="479" height="%d" rx="10" fill="%s" stroke="%s"/>'
        '<rect x="0.5" y="0.5" width="479" height="28" rx="10" fill="%s"/>'
        '<rect x="0.5" y="18" width="479" height="10" fill="%s"/>%s'
        '<text x="64" y="19" font-family="%s" font-size="12" fill="%s">%s</text>'
        '%s</svg>'
        % (W, h, W, h, h - 1, pal['bg'], pal['line'], pal['chrome'],
           pal['chrome'], dots, FONT, pal['dim'], escape(title), body))


def file_dot(pal, cx, cy, kind):
    color = pal['accent'] if kind == 'alya' else pal['dim']
    return '<rect x="%d" y="%d" width="9" height="11" rx="2" fill="none" stroke="%s"/>' % (
        cx, cy, color)


def step1(pal):
    y = 66
    b = text_row(y, [('PS E:\\demo> ', pal['dim']), ('alya --version', pal['fg'])])
    y += 26
    b += text_row(y, [('alya 0.0.19 (windows-x86_64)', pal['str'])])
    y += 34
    b += text_row(y, [('PS E:\\demo> ', pal['dim']), ('alya run hello.alya', pal['fg'])])
    y += 26
    b += text_row(y, [('Hello', pal['fg'])])
    y += 26
    b += text_row(y, [('exit 0', pal['dim']), ('  █', pal['accent'])])
    return window(pal, 'Terminal', b)


def step2(pal):
    y = 62
    b = text_row(y, [('▾ my-project', pal['dim'])])
    y += 26
    b += text_row(y, [('▸ src', pal['dim'])], x=36)
    y += 30
    b += ('<rect x="12" y="%d" width="456" height="26" rx="6" fill="%s"/>'
          % (y - 19, pal['hl']))
    b += file_dot(pal, 40, y - 15, 'alya')
    b += text_row(y, [('hello.alya', pal['fg'])], x=58)
    y += 30
    b += file_dot(pal, 40, y - 15, 'alya')
    b += text_row(y, [('main.alya', pal['dim'])], x=58)
    y += 30
    b += file_dot(pal, 40, y - 15, 'txt')
    b += text_row(y, [('notes.txt', pal['dim'])], x=58)
    y += 30
    b += text_row(y, [('▸ tests', pal['dim'])], x=36)
    return window(pal, 'Explorer', b)


def step3(pal):
    b = ('<rect x="12" y="36" width="130" height="24" rx="6" fill="%s"/>'
         % pal['chrome'])
    b += text_row(54, [('hello.alya   ×', pal['dim'])], x=24, size=12)
    b += text_row(88, [('1  ', pal['num']), ('say ', pal['kw']),
                       ('"Hello, Alya!"', pal['str'])])
    b += text_row(114, [('2  ', pal['num']), ('say ', pal['kw']),
                        ('"2 + 2 = ', pal['str']), ('{2 + 2}', pal['fg']),
                        ('"', pal['str'])])
    b += '<line x1="12" y1="132" x2="468" y2="132" stroke="%s"/>' % pal['line']
    b += text_row(156, [('$ alya run hello.alya', pal['dim'])])
    b += text_row(182, [('Hello, Alya!', pal['fg'])])
    b += text_row(208, [('2 + 2 = 4', pal['fg'])])
    b += text_row(234, [('exit 0', pal['dim'])])
    b += ('<rect x="0.5" y="251" width="479" height="22" fill="%s"/>'
          '<rect x="0.5" y="251" width="479" height="1" fill="%s"/>'
          % (pal['chrome'], pal['line']))
    b += text_row(267, [('⎇ develop   ✓ 0', pal['dim'])], x=24, size=11)
    return window(pal, 'hello.alya — Alya', b, h=274)


def step4(pal):
    b = text_row(62, [('Color Theme', pal['dim'])])
    b += ('<rect x="12" y="70" width="216" height="26" rx="6" fill="%s"/>'
          % pal['hl'])
    b += text_row(89, [('✓ ', pal['check']), ('Alya Dark', pal['fg'])])
    b += text_row(118, [('   Dark+', pal['dim'])])
    b += text_row(147, [('   Light+', pal['dim'])])
    b += '<line x1="240" y1="44" x2="240" y2="162" stroke="%s"/>' % pal['line']
    b += text_row(62, [('Tests', pal['dim'])], x=260)
    b += text_row(89, [('✓ ', pal['check']), ('12 passed', pal['fg'])], x=260)
    b += text_row(118, [('✓ ', pal['check']), ('0 failed', pal['fg'])], x=260)
    b += text_row(147, [('Σ  0.42s', pal['dim'])], x=260)
    return window(pal, 'Setup', b, h=190)


def step5(pal):
    b = ('<circle cx="240" cy="78" r="26" fill="none" stroke="%s" stroke-width="3"/>'
         % pal['accent'])
    b += ('<text x="240" y="89" text-anchor="middle" font-family="%s" font-size="28" '
          'font-weight="bold" fill="%s">A</text>' % (FONT, pal['accent']))
    b += text_row(132, [('Write  •  Run  •  Test', pal['dim'])], x=240, anchor='middle', size=12)
    for i, label in enumerate(('Docs', 'Issues')):
        y = 152 + i * 34
        b += ('<rect x="170" y="%d" width="140" height="26" rx="13" fill="none" '
              'stroke="%s"/>' % (y, pal['accent']))
        b += text_row(y + 18, [(label + '  ▸', pal['accent'])], x=240,
                      anchor='middle')
    return window(pal, 'Alya', b, h=228)


STEPS = {'step1-terminal': step1, 'step2-file': step2, 'step3-run': step3,
         'step4-theme': step4, 'step5-docs': step5}

for name, fn in STEPS.items():
    for variant, pal in (('dark', DARK), ('light', LIGHT)):
        path = os.path.join(HERE, '%s-%s.svg' % (name, variant))
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(fn(pal))
        print(path)
