(function(){
  var nav = document.getElementById('nav');
  var scrollCue = document.getElementById('scrollCue');

  function onScroll(){
    if(window.scrollY > 40){
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if(scrollCue){
    scrollCue.addEventListener('click', function(){
      var about = document.getElementById('about');
      if(about) about.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Reveal window-section color once it's meaningfully in view.
  var windowSections = document.querySelectorAll('.window-section');
  var sectionObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        sectionObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  windowSections.forEach(function(section){ sectionObserver.observe(section); });

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
