/* Lightwell room, dust, and blur-in for every page except the homepage.
   The homepage keeps its own copy of this motion so the landing page
   behaves exactly as it did before the stylesheet moved. */
(function(){
  'use strict';
  var d = document;
  var root = d.documentElement;
  if(d.getElementById('viewport')) return;
  if(!d.body || !d.body.classList.contains('lw-site')) return;

  root.classList.add('anim');

  var REGIONS = {
    us:    { flag:'🇺🇸', short:'US',    link:'https://www.tiktok.com/t/ZTDDdEtB8/' },
    latam: { flag:'🌎', short:'LATAM', link:'https://www.tiktok.com/t/ZMk1B9spE/' },
    uk:    { flag:'🇬🇧', short:'UK',    link:'https://www.tiktok.com/t/ZMk1BQ1xH/' },
    au:    { flag:'🇦🇺', short:'AU/NZ', link:'https://www.tiktok.com/t/ZS6RL85mg/' }
  };

  function store(key, val){
    try{
      if(val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    }catch(e){}
    return null;
  }

  /* ---------- dust in the light: drawn once, then a still background ---------- */
  (function(){
    var host = d.querySelector('.lw-dust'), shaft = d.querySelector('.lw-shaft');
    if(!host || !shaft) return;
    var coarse = window.matchMedia('(pointer:coarse)').matches;
    var TILT = 14 * Math.PI / 180;
    var DX = Math.sin(TILT), DY = Math.cos(TILT);
    var url = null;

    function paint(){
      var VW = window.innerWidth, VH = window.innerHeight;
      var g = { x:shaft.offsetLeft + shaft.offsetWidth / 2, y:shaft.offsetTop,
                half:shaft.offsetWidth / 2, len:shaft.offsetHeight };
      function light(x, y){
        var rx = x - g.x, ry = y - g.y, t = rx * DX + ry * DY;
        if(t < 0) return 0;
        var across = 1 - Math.abs(rx * DY - ry * DX) / (g.half * 0.9);
        if(across <= 0) return 0;
        var along = 1 - t / (g.len * 0.8);
        if(along <= 0) return 0;
        return across * across * (3 - 2 * across) * along;
      }
      var cv = d.createElement('canvas');
      if(!cv.getContext) return;
      cv.width = VW; cv.height = VH;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = 'rgb(228,236,255)';
      var n = 80 * (coarse ? 0.6 : 1) * (VW < 768 ? 0.7 : 1);
      for(var i = 0; i < n; i++){
        var x, y;
        if(Math.random() < 0.8){
          var t = Math.random() * g.len * 0.72, sd = (Math.random() * 2 - 1) * g.half * 0.75;
          x = g.x + t * DX + sd * DY; y = g.y + t * DY - sd * DX;
        } else { x = Math.random() * VW; y = Math.random() * VH; }
        var a = (0.04 + light(x, y) * 0.62) * (0.6 + Math.random() * 0.4);
        if(a < 0.03) continue;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(x, y, 0.45 + Math.random() * 1.2, 0, 6.2832);
        ctx.fill();
      }
      cv.toBlob(function(blob){
        if(!blob) return;
        if(url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        host.style.backgroundImage = 'url(' + url + ')';
      });
    }

    paint();
    var lastW = window.innerWidth, resizeTimer;
    window.addEventListener('resize', function(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){
        if(window.innerWidth !== lastW){ lastW = window.innerWidth; paint(); }
      }, 200);
    }, { passive:true });
  })();

  /* ---------- the shaft turns blue on Apply ---------- */
  var regionModal = d.getElementById('regionModal');
  var lwOver = false;
  function lwBlueSync(){
    var open = regionModal && regionModal.classList.contains('is-open');
    root.classList.toggle('lw-blue', !!lwOver || !!open);
  }
  d.addEventListener('pointerover', function(e){
    if(e.pointerType !== 'mouse' || !e.target.closest) return;
    if(e.target.closest('[data-apply]')){ lwOver = true; lwBlueSync(); }
  });
  d.addEventListener('pointerout', function(e){
    if(e.pointerType !== 'mouse' || !e.target.closest) return;
    var a = e.target.closest('[data-apply]');
    if(a && !(e.relatedTarget && a.contains(e.relatedTarget))){ lwOver = false; lwBlueSync(); }
  });
  d.addEventListener('focusin', function(e){
    if(e.target.closest && e.target.closest('[data-apply]')){ lwOver = true; lwBlueSync(); }
  });
  d.addEventListener('focusout', function(e){
    if(e.target.closest && e.target.closest('[data-apply]')){ lwOver = false; lwBlueSync(); }
  });

  /* effects hold still while the tab is hidden */
  (function(){
    function hidden(){ root.classList.toggle('lw-paused', d.hidden); }
    d.addEventListener('visibilitychange', hidden);
    hidden();
  })();

  /* ---------- division switch thumb ---------- */
  var thumb = d.getElementById('switchThumb');
  function syncSwitch(){
    var active = d.querySelector('#switch .switch-btn.is-on');
    if(active && thumb){
      thumb.style.width = active.offsetWidth + 'px';
      thumb.style.transform = 'translateX(' + (active.offsetLeft - 4) + 'px)';
    }
  }
  syncSwitch();
  window.addEventListener('load', syncSwitch);
  window.addEventListener('resize', function(){ setTimeout(syncSwitch, 60); });
  setTimeout(syncSwitch, 400);

  /* ---------- region chip, same memory as the homepage ---------- */
  var sheet = d.getElementById('sheet');
  var burger = d.getElementById('burger');
  function setRegion(key){
    var r = REGIONS[key];
    if(!r) return;
    store('thundrr-region', key);
    [].forEach.call(d.querySelectorAll('[data-region-flag]'), function(el){ el.textContent = r.flag; });
    [].forEach.call(d.querySelectorAll('[data-region-short]'), function(el){ el.textContent = r.short; });
    [].forEach.call(d.querySelectorAll('.rcard, #sheetRegions button'), function(el){
      el.classList.toggle('is-on', el.getAttribute('data-region') === key);
    });
  }
  var saved = store('thundrr-region') || 'us';
  if(!REGIONS[saved]) saved = 'us';
  setRegion(saved);

  function closeSheet(){
    if(!sheet || !burger) return;
    sheet.classList.remove('is-open');
    burger.classList.remove('is-on');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
  }
  function openRegion(){
    if(!regionModal) return;
    closeSheet();
    regionModal.classList.add('is-open');
    regionModal.setAttribute('aria-hidden', 'false');
    d.body.classList.add('is-locked');
    lwBlueSync();
    var current = regionModal.querySelector('.rcard.is-on') || regionModal.querySelector('.rcard');
    if(current) current.focus();
  }
  function closeRegion(){
    if(!regionModal) return;
    regionModal.classList.remove('is-open');
    regionModal.setAttribute('aria-hidden', 'true');
    if(!sheet || !sheet.classList.contains('is-open')) d.body.classList.remove('is-locked');
    lwBlueSync();
  }

  d.addEventListener('click', function(e){
    var t = e.target;
    if(t.closest && t.closest('#regionChip')){
      e.preventDefault();
      if(regionModal && regionModal.classList.contains('is-open')) closeRegion();
      else openRegion();
      return;
    }
    if(t.closest && t.closest('#regionX')){ e.preventDefault(); closeRegion(); return; }
    if(regionModal && t === regionModal){ closeRegion(); return; }
    var opt = t.closest && t.closest('[data-region]');
    if(opt){
      var key = opt.getAttribute('data-region');
      setRegion(key);
      closeRegion();
      closeSheet();
      if(opt.tagName === 'BUTTON' && REGIONS[key]){
        e.preventDefault();
        window.open(REGIONS[key].link, '_blank', 'noopener');
      }
    }
  });
  d.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeRegion();
  });

  /* stagger the blocks guides.js reveals, 30ms apart */
  var blocks = d.querySelectorAll('.take,.prose ul.cards,.prose ul.stats,.tbl,.prose blockquote,.prose ol.steps,.graphic,.cta-inline,.g-bio,.faq,.g-card,.cta');
  [].forEach.call(blocks, function(el, i){ el.style.setProperty('--i', String(Math.min(i, 12))); });
})();
