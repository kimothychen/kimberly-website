(function(){
  // Live New York time next to "Based in" on the cover.
  var clock = document.getElementById('clock');
  if(clock){
    var fmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit',
      timeZone: 'America/New_York', timeZoneName: 'short'
    });
    var tick = function(){
      clock.textContent = '· ' + fmt.format(new Date());
    };
    tick();
    setInterval(tick, 15000);
  }

  // Underline the nav link for whichever section is on screen.
  var navLinks = document.querySelectorAll('.topbar-nav a');
  var sections = [];
  navLinks.forEach(function(link){
    var target = document.getElementById(link.getAttribute('href').slice(1));
    if(target) sections.push({ link: link, el: target });
  });
  var markActive = function(){
    var line = window.innerHeight * 0.35;
    var current = null;
    sections.forEach(function(s){
      if(s.el.getBoundingClientRect().top <= line) current = s;
    });
    if(window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2){
      current = sections[sections.length - 1];
    }
    sections.forEach(function(s){ s.link.classList.toggle('is-active', s === current); });
  };
  window.addEventListener('scroll', markActive, { passive: true });
  window.addEventListener('resize', markActive);
  markActive();

  // Scroll to sections without leaving "#about" etc. in the address bar.
  var idFromHref = function(href){
    var m = /^\/?#(.+)$/.exec(href || '');
    return m ? m[1] : null;
  };
  document.addEventListener('click', function(e){
    var link = e.target.closest('a[href]');
    if(!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var target = document.getElementById(idFromHref(link.getAttribute('href')));
    if(!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  });
  // Arriving from another page via /#work: jump there, then tidy the address.
  if(location.hash){
    var landing = document.getElementById(location.hash.slice(1));
    if('scrollRestoration' in history) history.scrollRestoration = 'manual';
    var settle = function(){
      if(landing) landing.scrollIntoView();
      history.replaceState(null, '', location.pathname + location.search);
    };
    // wait for images and fonts so the section sits where it will finally be
    document.readyState === 'complete' ? settle() : window.addEventListener('load', settle);
  }
})();
