#!/usr/bin/env python3
"""Validate local HTML/CSS references, anchors and per-page SEO without dependencies."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,unquote
import re,json
root=Path(__file__).resolve().parent.parent
class Page(HTMLParser):
 def __init__(self,text):
  super().__init__();self.refs=[];self.ids=set();self.meta={};self.canonical=[];self.scripts=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if a.get('id'):self.ids.add(a['id'])
  for k in ['src','href','poster','data-approved-src']:
   if a.get(k):self.refs.append(a[k])
  if tag=='meta':self.meta[a.get('name',a.get('property'))]=a.get('content')
  if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
  if tag=='script' and a.get('src'):self.scripts.append(a['src'])
pages={p.name:Page(p.read_text()) for p in root.glob('*.html')};errors=[]
for name,page in pages.items():
 for ref in page.refs:
  u=urlsplit(ref)
  if u.scheme or u.netloc:continue
  target=root/unquote(u.path) if u.path else root/name
  if not target.exists():errors.append(f'{name}: missing {ref}')
  if u.fragment and target.suffix=='.html' and u.fragment not in pages[target.name].ids:errors.append(f'{name}: missing anchor {ref}')
 for key in ['description','og:title','og:description','og:url','og:image','twitter:card']:
  if not page.meta.get(key):errors.append(f'{name}: missing SEO {key}')
 if len(page.canonical)!=1:errors.append(f'{name}: canonical count')
 if page.scripts.index('js/contact.js')>page.scripts.index('js/r47.js'):errors.append(f'{name}: wrong form script order')
 if page.scripts.count('js/analytics.js')!=1:errors.append(f'{name}: analytics count')
for p in (root/'css').glob('*.css'):
 for _,ref in re.findall(r'url\(([\"\']?)([^)\"\']+)\1\)',p.read_text()):
  if not urlsplit(ref).scheme and not (p.parent/ref).exists():errors.append(f'{p.name}: missing {ref}')
print(json.dumps({'pages':len(pages),'errors':errors},ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
