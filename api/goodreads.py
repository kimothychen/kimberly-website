"""Serve Kimberly's Goodreads shelves as JSON for the library page.

Goodreads has retired its API and shelf RSS feeds, and shelf pages now need a
login, but its "add your shelf to your blog" custom widget is still public.
This fetches that widget for each shelf (newest first) and pulls the books out
of its HTML. Vercel runs it as a serverless function at /api/goodreads and
caches the response at the edge for an hour. If the widget ever stops parsing,
the function errors and the edge keeps serving the last good copy.
"""
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler
import json
import re
import urllib.request

USER_ID = '144512490'
WIDGET_URL = (
    'https://www.goodreads.com/review/custom_widget/{user}'
    '?shelf={shelf}&num_books=1000&sort={sort}&order=d&widget_id={shelf}'
)
SHELVES = {
    # key in the JSON: (Goodreads shelf, sort order)
    'currentlyReading': ('currently-reading', 'date_added'),
    'books': ('read', 'date_read'),
}


def cover_size(url, height=475):
    # Widget thumbnails look like ..._SY75_.jpg or ..._SX50_SY75_.jpg. Originals can run to 2MB,
    # so swap the size tokens for a fixed height that stays sharp on retina at grid size.
    return re.sub(r'\._(?:S[XY]\d+_)+(?=\.\w+$)', f'._SY{height}_', url)


def widget_html(js):
    # The widget is a script that assigns its markup to a JS string literal
    start = js.index("var widget_code = '") + len("var widget_code = '")
    end = js.index("var widget_div", start)
    body = js[start:end].rstrip().rstrip(';').rstrip("'")
    for esc, char in (('\\n', '\n'), ('\\"', '"'), ("\\'", "'"), ('\\/', '/')):
        body = body.replace(esc, char)
    return body


class WidgetParser(HTMLParser):
    """Collect one dict per gr_custom_each_container block."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.books = []
        self.book = None
        self.part = None
        self.capture = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get('class') or ''
        if tag == 'div' and cls.startswith('gr_custom_each_container'):
            self.book = {'title': '', 'author': '', 'cover': '', 'url': '', 'rating': 0}
        elif self.book is None:
            return
        elif tag == 'div' and cls.startswith('gr_custom_'):
            # classes carry the widget id as a suffix (e.g. gr_custom_title_currently_reading)
            m = re.match(r'gr_custom_(book_container|rating|title|author)', cls)
            self.part = m.group(1) if m else None
        elif self.part == 'book_container' and tag == 'img':
            self.book['cover'] = a.get('src', '')
        elif self.part == 'book_container' and tag == 'a':
            self.book['url'] = (a.get('href') or '').split('?')[0]
        elif self.part == 'rating' and tag == 'img' and 'star_active' in (a.get('src') or ''):
            self.book['rating'] += 1
        elif self.part in ('title', 'author') and tag == 'a' and not self.book[self.part]:
            # first link only; the widget footer links follow the last author
            self.capture = self.part

    def handle_endtag(self, tag):
        if tag == 'a':
            self.capture = None

    def handle_data(self, data):
        if self.book is not None and self.capture:
            self.book[self.capture] += data

    def flush(self):
        if self.book and self.book['title'].strip():
            self.books.append(self.book)
        self.book = None
        self.part = None


def parse(js):
    p = WidgetParser()
    # each book block starts a new container, so close out the previous one first
    for chunk in re.split(r'(?=<div class="gr_custom_each_container)', widget_html(js)):
        p.feed(chunk)
        p.flush()
    books = []
    for i, b in enumerate(p.books):
        cover = b['cover']
        books.append({
            'id': b['url'].rsplit('/', 1)[-1],
            'title': ' '.join(b['title'].split()),
            'author': ' '.join(b['author'].split()),
            'cover': '' if 'nophoto' in cover else cover_size(cover),
            'rating': b['rating'],
            'order': i,
            'url': b['url'],
        })
    return books


def fetch_shelf(shelf, sort):
    req = urllib.request.Request(
        WIDGET_URL.format(user=USER_ID, shelf=shelf, sort=sort),
        headers={'User-Agent': 'kimberlyhchen.com library'},
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        return parse(resp.read().decode('utf-8', 'replace'))


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            payload = {key: fetch_shelf(*args) for key, args in SHELVES.items()}
            if not payload['books']:
                raise ValueError('read shelf parsed empty; widget markup may have changed')
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
