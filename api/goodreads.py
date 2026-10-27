"""Serve Kimberly's Goodreads "read" shelf as JSON for the library page.

Goodreads retired its API, but every public profile still publishes an RSS
feed per shelf. Vercel runs this as a serverless function at /api/goodreads
and caches the response at the edge for an hour.
"""
from email.utils import parsedate_to_datetime
from http.server import BaseHTTPRequestHandler
import json
import re
import urllib.request
import xml.etree.ElementTree as ET

USER_ID = '144512490'
FEED = 'https://www.goodreads.com/review/list_rss/{user}?shelf=read&page={page}'
MAX_PAGES = 20


def full_size(url):
    # Goodreads serves thumbnails like ..._SY475_.jpg; dropping the size token returns the original
    return re.sub(r'\._S[XY]\d+_(?=\.\w+$)', '', url)


def iso_date(value):
    try:
        return parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError):
        return ''


def parse(xml_bytes):
    books = []
    for item in ET.fromstring(xml_bytes).iter('item'):
        get = lambda tag: (item.findtext(tag) or '').strip()
        cover = get('book_large_image_url') or get('book_image_url')
        books.append({
            'id': get('book_id'),
            'title': get('title'),
            'author': get('author_name'),
            'cover': '' if 'nophoto' in cover else full_size(cover),
            'readAt': iso_date(get('user_read_at')),
            'addedAt': iso_date(get('user_date_added')),
            'rating': int(get('user_rating') or 0),
            'shelves': [s.strip() for s in get('user_shelves').split(',') if s.strip()],
            'url': get('link'),
        })
    return books


def fetch_shelf():
    books, seen = [], set()
    for page in range(1, MAX_PAGES + 1):
        req = urllib.request.Request(
            FEED.format(user=USER_ID, page=page),
            headers={'User-Agent': 'kimberlyhchen.com library'},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            batch = [b for b in parse(resp.read()) if b['id'] not in seen]
        if not batch:
            break
        seen.update(b['id'] for b in batch)
        books.extend(batch)
    return books


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            payload, status = {'books': fetch_shelf()}, 200
            cache = 'public, s-maxage=3600, stale-while-revalidate=86400'
        except Exception:
            payload, status = {'error': 'Goodreads shelf unavailable'}, 502
            cache = 'no-store'
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', cache)
        self.end_headers()
        self.wfile.write(body)
