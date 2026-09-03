(function(){
  var scrollCue = document.getElementById('scrollCue');

  if(scrollCue){
    scrollCue.addEventListener('click', function(){
      var about = document.getElementById('about');
      if(about) about.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Live New York clock in the hero.
  var clock = document.getElementById('clock');
  if(clock){
    var fmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', second: '2-digit',
      timeZone: 'America/New_York', timeZoneName: 'short'
    });
    var tick = function(){
      clock.textContent = fmt.format(new Date()) + ' · New York, NY';
    };
    tick();
    setInterval(tick, 1000);
  }

  // Bloom each section's aurora once it scrolls into view.
  var revealSections = document.querySelectorAll('.reveal-section');
  var auroraObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        var auroras = entry.target.querySelectorAll('.aurora');
        auroras.forEach(function(el){
          el.classList.remove('dormant');
          el.classList.add('bloom');
        });
        auroraObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });
  revealSections.forEach(function(section){ auroraObserver.observe(section); });

  // Reveal each job entry with a small stagger as it scrolls in.
  var jobs = document.querySelectorAll('.job');
  var jobObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        jobObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -40px 0px' });
  jobs.forEach(function(job, i){
    job.style.transitionDelay = Math.min(i * 60, 240) + 'ms';
    jobObserver.observe(job);
  });

  // Cycle the word inside the contact circle.
  var cycleWord = document.getElementById('cycleWord');
  if(cycleWord){
    var words = ['Connect', 'Talk', 'Build', 'Collaborate'];
    var idx = 0;
    setInterval(function(){
      cycleWord.classList.add('fade');
      window.setTimeout(function(){
        idx = (idx + 1) % words.length;
        cycleWord.textContent = words[idx];
        cycleWord.classList.remove('fade');
      }, 400);
    }, 2600);
  }

  // Smooth-scroll for in-page nav links.
  document.querySelectorAll('a[href^="#"]').forEach(function(link){
    link.addEventListener('click', function(e){
      var id = link.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if(target){
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
})();
