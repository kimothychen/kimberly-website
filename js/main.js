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
})();
