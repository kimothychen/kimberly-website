"""Serve Kimberly's Goodreads shelves as JSON for the library page.

Goodreads has retired both its API and its shelf RSS feeds, so this reads the
public shelf pages (the profile is set to public) and pulls each book out of
the table rows. Vercel runs it as a serverless function at /api/goodreads and
caches the response at the edge for an hour, so Goodreads sees at most a
couple of page loads an hour. If Goodreads changes its markup and nothing
parses, the function errors and the edge keeps serving the last good copy.
"""
from datetime import datetime
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler
import json
import re
import urllib.request

USER_ID = '144512490'
SHELF_URL = 'https://www.goodreads.com/review/list/{user}?shelf={shelf}&per_page=100&page={page}&print=true'
MAX_PAGES = 20


def full_size(url):
    # Goodreads serves thumbnails like ..._SY75_.jpg; dropping the size token returns the original
    return re.sub(r'\._S[XY]\d+_(?=\.\w+$)', '', url)


def iso_date(text):
    text = ' '.join(text.split())
    for fmt in ('%b %d, %Y', '%B %d, %Y', '%b %Y', '%B %Y', '%Y'):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    return ''


def display_author(name):
    # Shelf tables list authors as "Last, First *"
    name = name.replace('*', '').strip()
    if ',' in name:
        last, first = [p.strip() for p in name.split(',', 1)]
        name = f'{first} {last}'
    return ' '.join(name.split())


class ShelfParser(HTMLParser):
    """Collect one dict per <tr class="bookalike review"> row."""

    def __init__(self):
        super().__init__()
        self.books = []
        self.row = None
        self.field = None
        self.capture = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get('class') or ''
        if tag == 'tr' and 'bookalike' in cls:
            self.row = {'id': (a.get('id') or '').replace('review_', ''), 'stars': 0, 'readAt': '', 'startedAt': '', 'addedAt': ''}
            return
        if self.row is None:
            return
        if tag == 'td' and cls.startswith('field '):
            self.field = cls.split()[1]
        elif self.field == 'cover' and tag == 'img':
            self.row['cover'] = a.get('src', '')
        elif self.field == 'title' and tag == 'a' and 'title' not in self.row:
            self.row['title'] = (a.get('title') or '').strip()
            self.row['url'] = 'https://www.goodreads.com' + a.get('href', '') if a.get('href', '').startswith('/') else a.get('href', '')
        elif self.field == 'author' and tag == 'a' and 'author' not in self.row:
            self.capture = 'author'
            self.row['author'] = ''
        elif self.field == 'rating' and tag == 'span' and 'staticStar' in cls and 'p10' in cls:
            self.row['stars'] += 1
        elif self.field in ('date_read', 'date_started') and tag == 'span' and 'value' in cls:
            self.capture = 'readAt' if self.field == 'date_read' else 'startedAt'
        elif self.field == 'date_added' and tag == 'span' and a.get('title'):
            self.row['addedAt'] = iso_date(a['title'])

    def handle_endtag(self, tag):
        if tag == 'a' and self.capture == 'author':
            self.capture = None
        elif tag == 'span' and self.capture in ('readAt', 'startedAt'):
            self.row[self.capture] = iso_date(self.row.get(self.capture + '_raw', ''))
            self.capture = None
        elif tag == 'td':
            self.field = None
        elif tag == 'tr' and self.row is not None:
            r = self.row
            if r.get('title'):
                cover = r.get('cover', '')
                self.books.append({
                    'id': r['id'],
                    'title': r['title'],
                    'author': display_author(r.get('author', '')),
                    'cover': '' if 'nophoto' in cover else full_size(cover),
                    'readAt': r['readAt'],
                    'startedAt': r['startedAt'],
                    'addedAt': r['addedAt'],
                    'rating': r['stars'],
                    'url': r.get('url', ''),
                })
            self.row = None

    def handle_data(self, data):
        if self.capture == 'author':
            self.row['author'] += data
        elif self.capture in ('readAt', 'startedAt'):
            key = self.capture + '_raw'
            self.row[key] = self.row.get(key, '') + data


def parse(html):
    p = ShelfParser()
    p.feed(html)
    return p.books


def fetch_shelf(shelf):
    books, seen = [], set()
    for page in range(1, MAX_PAGES + 1):
        req = urllib.request.Request(
            SHELF_URL.format(user=USER_ID, shelf=shelf, page=page),
            headers={'User-Agent': 'kimberlyhchen.com library (one request per shelf per hour)'},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            batch = [b for b in parse(resp.read().decode('utf-8', 'replace')) if b['id'] not in seen]
        if not batch:
            break
        seen.update(b['id'] for b in batch)
        books.extend(batch)
    return books


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            payload = {
                'currentlyReading': fetch_shelf('currently-reading'),
                'books': fetch_shelf('read'),
            }
            if not payload['books']:
                raise ValueError('read shelf parsed empty; markup may have changed')
            status = 200
            # serve from the edge for an hour, and keep the last good copy for a week if Goodreads breaks
            cache = 'public, s-maxage=3600, stale-while-revalidate=604800, stale-if-error=604800'
        except Exception:
            payload, status = {'error': 'Goodreads shelf unavailable'}, 502
            cache = 'no-store'
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', cache)
        self.end_headers()
        self.wfile.write(body)
