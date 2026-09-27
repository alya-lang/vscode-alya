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
    'check': '#34d399', 'hl': '#1e3a5f55', 'line': '#1c2742',
}
LIGHT = {
    'bg': '#f8fafc', 'chrome': '#f1f5f9', 'fg': '#1e293b', 'dim': '#64748b',
    'kw': '#7c3aed', 'str': '#047857', 'fn': '#0369a1', 'accent': '#0284c7',
    'check': '#059669', 'hl': '#bae6fd', 'line': '#e2e8f0',
}
FONT = "Consolas, 'Courier New', monospace"


def text_row(y, segs, x=24, size=13, bold_first=False):
    parts = []
    for idx, (t, c) in enumerate(segs):
        w = ' font-weight="bold"' if bold_first and idx == 0 else ''
        parts.append('<tspan fill="%s"%s>%s</tspan>' % (c, w, escape(t)))
    return '<text x="%d" y="%d" font-family="%s" font-size="%d">%s</text>' % (
        x, y, FONT, size, ''.join(parts))


def window(pal, title, body, h=300):
    dots = ''.join(
        '<circle cx="%d" cy="14" r="5" fill="%s"/>' % (20 + k * 18, c)
        for k, c in enumerate(['#f87171', '#fbbf24', '#34d399']))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="%d" viewBox="0 0 480 %d">'
        '<rect x="0.5" y="0.5" width="479" height="%d" rx="10" fill="%s" stroke="%s"/>'
        '<rect x="0.5" y="0.5" width="479" height="28" rx="10" fill="%s"/>'
        '<rect x="0.5" y="18" width="479" height="10" fill="%s"/>%s'
        '<text x="64" y="19" font-family="%s" font-size="12" fill="%s">%s</text>'
        '%s</svg>'
        % (h, h, h - 1, pal['bg'], pal['line'], pal['chrome'], pal['chrome'],
           dots, FONT, pal['dim'], escape(title), body))


def step1(pal):
    b = text_row(70, [('$ ', pal['dim']), ('alya --version', pal['fg'])])
    b += text_row(96, [('alya 0.0.19 (windows-x86_64)', pal['str'])])
    b += text_row(122, [('█', pal['accent'])])
    return window(pal, 'Terminal', b)


def step2(pal):
    b = text_row(70, [('▸ my-project', pal['dim'])])
    b += ('<rect x="12" y="80" width="456" height="26" rx="6" fill="%s"/>'
          % pal['hl'])
    b += text_row(99, [('    hello.alya', pal['fg'])], )
    b += text_row(128, [('    notes.txt', pal['dim'])])
    return window(pal, 'Explorer', b)


def step3(pal):
    b = text_row(62, [('say ', pal['kw']), ('"Hello"', pal['str'])])
    b += '<line x1="12" y1="80" x2="468" y2="80" stroke="%s"/>' % pal['line']
    b += text_row(104, [('$ alya run hello.alya', pal['dim'])])
    b += text_row(130, [('Hello', pal['fg'])])
    b += text_row(156, [('exit 0', pal['dim'])])
    return window(pal, 'hello.alya', b, h=190)


def step4(pal):
    b = text_row(62, [('Color Theme', pal['dim'])])
    b += text_row(88, [('✓ ', pal['check']), ('Alya Dark', pal['fg'])])
    b += text_row(114, [('   Dark+', pal['dim'])])
    b += '<line x1="240" y1="44" x2="240" y2="176" stroke="%s"/>' % pal['line']
    b += text_row(62, [('Tests', pal['dim'])], x=260)
    b += text_row(88, [('✓ ', pal['check']), ('12 passed', pal['fg'])], x=260)
    b += text_row(114, [('✓ ', pal['check']), ('0 failed', pal['fg'])], x=260)
    return window(pal, 'Setup', b, h=190)


def step5(pal):
    b = ('<circle cx="240" cy="86" r="26" fill="none" stroke="%s" stroke-width="3"/>'
         % pal['accent'])
    b += ('<text x="240" y="97" text-anchor="middle" font-family="%s" font-size="28" '
          'font-weight="bold" fill="%s">A</text>' % (FONT, pal['accent']))
    b += text_row(150, [('Docs  ▸', pal['fn'])], x=200)
    b += text_row(176, [('Issues  ▸', pal['fn'])], x=200)
    return window(pal, 'Alya', b, h=210)


STEPS = {'step1-terminal': step1, 'step2-file': step2, 'step3-run': step3,
         'step4-theme': step4, 'step5-docs': step5}

for name, fn in STEPS.items():
    for variant, pal in (('dark', DARK), ('light', LIGHT)):
        path = os.path.join(HERE, '%s-%s.svg' % (name, variant))
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(fn(pal))
        print(path)
