(function(){
  var shelf = document.getElementById('shelf');
  var status = document.getElementById('shelfStatus');
  var sortButtons = document.querySelectorAll('.sort button');
  var books = [];

  var pad = function(n){ return (n < 10 ? '0' : '') + n + '.'; };

  // Sort "Recent" by date finished, falling back to when the book was shelved.
  var sorters = {
    recent: function(a, b){ return (b.readAt || b.addedAt).localeCompare(a.readAt || a.addedAt); },
    title: function(a, b){ return a.title.replace(/^(the|a|an) /i, '').localeCompare(b.title.replace(/^(the|a|an) /i, '')); },
    author: function(a, b){
      var last = function(name){ return name.split(' ').slice(-1)[0]; };
      return last(a.author).localeCompare(last(b.author)) || a.title.localeCompare(b.title);
    }
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

      if(book.cover){
        var img = document.createElement('img');
        img.src = book.cover;
        img.alt = book.title + ' by ' + book.author;
        img.loading = 'lazy';
        img.decoding = 'async';
        link.appendChild(img);
      } else {
        // No cover on Goodreads: set the title on a plain block instead
        var blank = document.createElement('span');
        blank.className = 'book-blank';
        blank.textContent = book.title;
        link.appendChild(blank);
      }

      var cap = document.createElement('span');
      cap.className = 'book-cap';
      cap.textContent = book.title.replace(/\s*\(.*?#\d+\)$/, '') + ' — ' + book.author;
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

  fetch('/api/goodreads')
    .then(function(res){ if(!res.ok) throw new Error(res.status); return res.json(); })
    .then(function(data){
      books = data.books || [];
      document.getElementById('countBooks').textContent = books.length;
      var authors = {};
      books.forEach(function(b){ authors[b.author] = true; });
      document.getElementById('countAuthors').textContent = Object.keys(authors).length;
      status.hidden = true;
      render('recent');
    })
    .catch(function(){
      status.innerHTML = 'The shelf is taking a break. See it on <a href="https://www.goodreads.com/user/show/144512490-kimberly" target="_blank" rel="noopener">Goodreads</a> for now.';
    });
})();
