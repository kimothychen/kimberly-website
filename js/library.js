(function(){
  var shelf = document.getElementById('shelf');
  var status = document.getElementById('shelfStatus');
  var sortButtons = document.querySelectorAll('.sort button');
  var books = [];

  var pad = function(n){ return (n < 10 ? '0' : '') + n + '.'; };

  // Goodreads hands the shelf over newest-read first, so "Recent" keeps its order.
  var sorters = {
    recent: function(a, b){ return a.order - b.order; },
    title: function(a, b){ return a.title.replace(/^(the|a|an) /i, '').localeCompare(b.title.replace(/^(the|a|an) /i, '')); },
    author: function(a, b){
      var last = function(name){ return name.split(' ').slice(-1)[0]; };
      return last(a.author).localeCompare(last(b.author)) || a.title.localeCompare(b.title);
    }
  };

  var cover = function(book){
    if(book.cover){
      var img = document.createElement('img');
      img.src = book.cover;
      img.alt = book.title + ' by ' + book.author;
      img.loading = 'lazy';
      img.decoding = 'async';
      return img;
    }
    // No cover on Goodreads: set the title on a plain block instead
    var blank = document.createElement('span');
    blank.className = 'book-blank';
    blank.textContent = book.title;
    return blank;
  };

  var shortTitle = function(title){ return title.replace(/\s*\(.*?#\d+\)$/, ''); };

  var renderNow = function(list){
    if(!list.length) return;
    var ul = document.getElementById('nowList');
    list.forEach(function(book){
      var li = document.createElement('li');
      var link = document.createElement('a');
      link.className = 'now-book';
      link.href = book.url;
      link.target = '_blank';
      link.rel = 'noopener';
      var art = document.createElement('span');
      art.className = 'now-cover';
      art.appendChild(cover(book));
      var text = document.createElement('span');
      text.className = 'now-text';
      text.innerHTML = '<span class="now-title"></span><span class="now-author"></span>';
      text.firstChild.textContent = shortTitle(book.title);
      text.lastChild.textContent = book.author;
      link.appendChild(art);
      link.appendChild(text);
      li.appendChild(link);
      ul.appendChild(li);
    });
    document.getElementById('nowReading').hidden = false;
  };

  var render = function(order){
    var sorted = books.slice().sort(sorters[order]);
    shelf.innerHTML = '';
    sorted.forEach(function(book, i){
      var li = document.createElement('li');
      li.className = 'book';

      var num = document.createElement('span');
      num.className = 'book-num';
      num.textContent = pad(i + 1);

      var link = document.createElement('a');
      link.className = 'book-link';
      link.href = book.url;
      link.target = '_blank';
      link.rel = 'noopener';

      link.appendChild(cover(book));

      var cap = document.createElement('span');
      cap.className = 'book-cap';
      cap.textContent = shortTitle(book.title) + ' — ' + book.author;
      link.appendChild(cap);

      li.appendChild(num);
      li.appendChild(link);
      shelf.appendChild(li);
    });
  };

  sortButtons.forEach(function(btn){
    btn.addEventListener('click', function(){
      sortButtons.forEach(function(b){ b.classList.toggle('is-active', b === btn); });
      render(btn.dataset.sort);
    });
  });

  // Goodreads retired its API and RSS feeds, and shelf pages need a login, but its
  // "add your shelf to your blog" widget is public. Each widget is a script that
  // assigns its markup to #gr_custom_widget_<id>.innerHTML.
  var USER = '144512490';

  var coverSize = function(url){
    // thumbnails end ..._SY75_.jpg or ..._SX50_SY75_.jpg; ask for 475px tall instead
    return /nophoto/.test(url) ? '' : url.replace(/\._(?:S[XY]\d+_)+(?=\.\w+$)/, '._SY475_');
  };

  var readWidget = function(markup){
    // DOMParser builds an inert document, so the widget's thumbnails never download
    var doc = new DOMParser().parseFromString(markup, 'text/html');
    var list = [];
    doc.querySelectorAll('[class^="gr_custom_each_container"]').forEach(function(el){
      var title = el.querySelector('[class^="gr_custom_title"] a');
      if(!title) return;
      var author = el.querySelector('[class^="gr_custom_author"] a');
      var img = el.querySelector('[class^="gr_custom_book_container"] img');
      list.push({
        title: title.textContent.trim().replace(/\s+/g, ' '),
        author: author ? author.textContent.trim().replace(/\s+/g, ' ') : '',
        cover: img ? coverSize(img.getAttribute('src')) : '',
        rating: el.querySelectorAll('[class^="gr_custom_rating"] img[src*="star_active"]').length,
        url: title.getAttribute('href').split('?')[0]
      });
    });
    return list;
  };

  var loadWidget = function(shelf, sort, order){
    return new Promise(function(resolve, reject){
      // Goodreads caches widgets by widget_id, so a fresh id per load keeps the shelf current
      var id = 'w' + Math.random().toString(36).slice(2, 10);
      var box = document.createElement('div');
      box.id = 'gr_custom_widget_' + id;
      box.hidden = true;
      var markup = '';
      // catch the markup instead of letting it render
      Object.defineProperty(box, 'innerHTML', { set: function(v){ markup = v; } });
      document.body.appendChild(box);
      var script = document.createElement('script');
      script.src = 'https://www.goodreads.com/review/custom_widget/' + USER +
        '?shelf=' + shelf + '&num_books=1000&sort=' + sort + '&order=' + order + '&widget_id=' + id;
      script.onerror = reject;
      script.onload = function(){
        box.remove();
        script.remove();
        var list = readWidget(markup);
        list.length ? resolve(list) : reject(new Error('empty shelf'));
      };
      document.body.appendChild(script);
    });
  };

  // Newest-read first. Books with no "date read" come after the dated ones when sorting
  // newest first and before them when sorting oldest first, in the same order both times,
  // so the dated run ends where the rest of one list matches the start of the other.
  // Undated books then follow by date added.
  var loadRead = function(){
    return Promise.all([
      loadWidget('read', 'date_read', 'd'),
      loadWidget('read', 'date_read', 'a'),
      loadWidget('read', 'date_added', 'd')
    ]).then(function(r){
      var desc = r[0], asc = r[1], added = r[2], n = desc.length;
      var key = function(list){ return list.map(function(b){ return b.url; }).join('|'); };
      var dated = n;
      for(var k = 0; k < n; k++){
        if(key(desc.slice(k)) === key(asc.slice(0, n - k))){ dated = k; break; }
      }
      var top = desc.slice(0, dated);
      var seen = {};
      top.forEach(function(b){ seen[b.url] = true; });
      return top.concat(added.filter(function(b){ return !seen[b.url]; }));
    });
  };

  Promise.all([loadWidget('currently-reading', 'date_started', 'd').catch(function(){ return []; }), loadRead()])
    .then(function(shelves){
      var number = function(list){ list.forEach(function(b, i){ b.order = i; }); return list; };
      return { currentlyReading: number(shelves[0]), books: number(shelves[1]) };
    })
    .then(function(data){
      books = data.books || [];
      document.getElementById('countBooks').textContent = books.length;
      var authors = {};
      books.forEach(function(b){ authors[b.author] = true; });
      document.getElementById('countAuthors').textContent = Object.keys(authors).length;
      status.hidden = true;
      renderNow(data.currentlyReading || []);
      render('recent');
    })
    .catch(function(){
      status.innerHTML = 'The shelf is taking a break. See it on <a href="https://www.goodreads.com/user/show/144512490-kimberly" target="_blank" rel="noopener">Goodreads</a> for now.';
    });
})();
