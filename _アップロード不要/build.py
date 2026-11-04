#!/usr/bin/env python3
"""Write an explicit deployment allowlist, never private config or QA files."""
import argparse
from pathlib import Path
import shutil,re
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--production',action='store_true',help='Compatibility option; output is identical for production and testing')
parser.add_argument('--out',required=True,help='New, empty output directory outside the repository')
parser.add_argument('--base-path',default='/',help='Installation URL path, for example /ai-fist/')
parser.add_argument('--https-host',help='Optional exact hostname to redirect from HTTP to HTTPS')
a=parser.parse_args();out=Path(a.out).resolve()
base='/' + a.base_path.strip('/') + '/' if a.base_path.strip('/') else '/'
if not re.fullmatch(r'/(?:[A-Za-z0-9_-]+/)*',base):parser.error('Invalid base path')
if a.https_host and not re.fullmatch(r'[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+',a.https_host):parser.error('Invalid HTTPS hostname')
if out==ROOT or ROOT in out.parents:parser.error('Output must be outside the source repository')
if out.exists() and any(out.iterdir()):parser.error('Output directory must be empty; existing contents will not be deleted')
out.mkdir(parents=True,exist_ok=True)
for folder in ['img','css','js','server']:shutil.copytree(ROOT/folder,out/folder,ignore=shutil.ignore_patterns('contact-config.php'))
for name in ['.htaccess','contact.php','sitemap.xml','robots.txt']:shutil.copy2(ROOT/name,out/name)
ht=(out/'.htaccess').read_text()
ht=ht.replace(' features.html ',f' {base}features.html ').replace(' feature-0$1.html ',f' {base}feature-0$1.html ')
ht=ht.replace(r'\s/+index\.html',r'\s/+'+re.escape(base.strip('/'))+('/' if base!='/' else '')+r'index\.html')
ht=ht.replace(r'^index\.html$ / ',rf'^index\.html$ {base} ')
if a.https_host:
 ht=ht.replace('RewriteEngine On','RewriteEngine On\nRewriteCond %{HTTP_HOST} ^'+re.escape(a.https_host)+'$ [NC]\nRewriteCond %{HTTPS} !=on\nRewriteRule ^ https://'+a.https_host+'%{REQUEST_URI} [R=302,L]')
(out/'.htaccess').write_text(ht)
for source in ROOT.glob('*.html'):
 shutil.copy2(source,out/source.name)
# Same files for both hosts. Protect staging using server-side Basic authentication.
# Do not insert an unconditional GTM noscript iframe: it would run on staging too.
print(f'Common deployment package: {out}')
print('Private PHP config is not included. Copy local server/contact-config.php into the output server directory before private FTP deployment.')
