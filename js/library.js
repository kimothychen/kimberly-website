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
  // writes its markup into #gr_custom_widget_<id>, so load both into hidden boxes
  // and read the books back out.
  var USER = '144512490';
  var WIDGETS = { now: ['currently-reading', 'date_added'], read: ['read', 'date_read'] };

  var coverSize = function(url){
    // thumbnails end ..._SY75_.jpg or ..._SX50_SY75_.jpg; ask for 475px tall instead
    return /nophoto/.test(url) ? '' : url.replace(/\._(?:S[XY]\d+_)+(?=\.\w+$)/, '._SY475_');
  };

  var loadShelf = function(id){
    return new Promise(function(resolve, reject){
      var box = document.createElement('div');
      box.id = 'gr_custom_widget_' + id;
      box.hidden = true;
      document.body.appendChild(box);
      var script = document.createElement('script');
      script.src = 'https://www.goodreads.com/review/custom_widget/' + USER +
        '?shelf=' + WIDGETS[id][0] + '&num_books=1000&sort=' + WIDGETS[id][1] +
        '&order=d&widget_id=' + id;
      script.onerror = reject;
      script.onload = function(){
        var list = [];
        box.querySelectorAll('[class^="gr_custom_each_container"]').forEach(function(el, i){
          var title = el.querySelector('[class^="gr_custom_title"] a');
          if(!title) return;
          var author = el.querySelector('[class^="gr_custom_author"] a');
          var img = el.querySelector('[class^="gr_custom_book_container"] img');
          list.push({
            title: title.textContent.trim().replace(/\s+/g, ' '),
            author: author ? author.textContent.trim().replace(/\s+/g, ' ') : '',
            cover: img ? coverSize(img.getAttribute('src')) : '',
            rating: el.querySelectorAll('[class^="gr_custom_rating"] img[src*="star_active"]').length,
            url: title.href.split('?')[0],
            order: i
          });
        });
        box.remove();
        list.length ? resolve(list) : reject(new Error('empty shelf'));
      };
      document.body.appendChild(script);
    });
  };

  Promise.all([loadShelf('now').catch(function(){ return []; }), loadShelf('read')])
    .then(function(shelves){ return { currentlyReading: shelves[0], books: shelves[1] }; })
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
