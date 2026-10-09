#!/usr/bin/env python3
"""Rebuild checked-in, printable guides. Requires Python package markdown2."""
from pathlib import Path
import html
import markdown2

root = Path(__file__).resolve().parents[2]
style = '''
:root{color-scheme:light;font-family:system-ui,-apple-system,sans-serif;color:#24352c;background:#f5f5ef;line-height:1.65}
*{box-sizing:border-box}body{margin:0}header{background:#203c2c;color:white;padding:22px max(20px,calc((100% - 960px)/2));}header a{color:white;margin-right:22px}header p{margin:8px 0 0;font-size:13px;color:#d3dfd3}
main{max-width:960px;padding:32px 28px 70px;margin:auto;background:white}h1{font-size:36px;line-height:1.15}h2{margin-top:44px;padding-top:18px;border-top:1px solid #dce2d8;line-height:1.3;scroll-margin-top:20px}a{color:#24613c;text-underline-offset:3px}li{padding:5px 0}strong{font-weight:650}table{width:100%;border-collapse:collapse;font-size:14px;margin:22px 0}td,th{border:1px solid #d6ddcf;padding:12px;text-align:left;vertical-align:top}th{background:#edf2e8}code{background:#edf2e8;padding:2px 4px;overflow-wrap:anywhere}button{font:inherit;cursor:pointer;padding:10px 18px;border:1px solid #c8d5c8;border-radius:6px;background:white;color:#203c2c}nav.toc{background:#edf2e8;padding:18px 24px;border-radius:8px}nav.toc a{display:block;padding:5px 0;font-size:14px}:focus-visible{outline:3px solid #cb8138;outline-offset:3px}
@media(max-width:600px){main{padding:22px 18px}h1{font-size:29px}table{font-size:12px}td,th{padding:7px;overflow-wrap:anywhere}}
@media print{header,.toc,.print{display:none}body,main{background:white}main{max-width:none;padding:0;font-size:10pt}h1{font-size:24pt}h2{break-after:avoid;font-size:15pt;margin-top:24px}tr,li{break-inside:avoid}a{color:inherit}table{font-size:9pt}@page{margin:18mm}}
'''
for name in ('dwp611', 'jtech-7w'):
    source = root / 'deployment/guides' / (name + '.md')
    content = markdown2.markdown(source.read_text(), extras=['tables', 'header-ids', 'toc'])
    content_html = str(content).replace('href="dwp611.md"', 'href="dwp611.html"').replace('href="jtech-7w.md"', 'href="jtech-7w.html"')
    section_start = content_html.index('<h2')
    intro, sections = content_html[:section_start], content_html[section_start:]
    title = source.read_text().splitlines()[0][2:]
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} · Shapeoko workstation</title><style>{style}</style></head><body><header><nav aria-label="Operator guides"><a href="dwp611.html">DWP611 milling</a><a href="jtech-7w.html">J Tech 7W laser</a></nav><p>SHAPEOKO 3 XL · OPERATOR HANDBOOK · 2026-10-09</p></header><main><button class="print" onclick="window.print()">Print / save as PDF</button>{intro}<nav class="toc" aria-label="On this page">{content.toc_html}</nav>{sections}</main></body></html>'''
    target = root / 'src/app/assets/guides' / (name + '.html')
    target.write_text(page)
    print(target.relative_to(root))
