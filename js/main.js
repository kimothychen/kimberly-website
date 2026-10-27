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
})();
