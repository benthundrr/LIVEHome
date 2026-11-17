/* Lightwell room, dust, and blur-in for every page except the homepage.
   The homepage keeps its own copy of this motion so the landing page
   behaves exactly as it did before the stylesheet moved. */
(function(){
  'use strict';
  var d = document;
  var root = d.documentElement;
  if(d.getElementById('viewport')) return;
  if(!d.body || !d.body.classList.contains('lw-site')) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  /* ---------- dust in the shaft ---------- */
  (function(){
    var cv = d.querySelector('.lw-dust'), shaft = d.querySelector('.lw-shaft');
    if(!cv || !shaft || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var coarse = window.matchMedia('(pointer:coarse)').matches;
    var TILT = 14 * Math.PI / 180;
    var DX = Math.sin(TILT), DY = Math.cos(TILT);
    var W = 0, H = 0, g = null, parts = [], raf = 0, prev = 0;

    function measure(){
      var dpr = 1;
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgb(228,236,255)';
      g = { x:shaft.offsetLeft + shaft.offsetWidth / 2, y:shaft.offsetTop,
            half:shaft.offsetWidth / 2, len:shaft.offsetHeight };
    }
    function light(x, y){
      var rx = x - g.x, ry = y - g.y;
      var t = rx * DX + ry * DY;
      if(t < 0) return 0;
      var across = 1 - Math.abs(rx * DY - ry * DX) / (g.half * 0.9);
      if(across <= 0) return 0;
      var along = 1 - t / (g.len * 0.8);
      if(along <= 0) return 0;
      return across * across * (3 - 2 * across) * along;
    }
    function spawn(p){
      for(var k = 0; k < 6; k++){
        if(Math.random() < 0.78){
          var t = Math.random() * g.len * 0.72, s = (Math.random() * 2 - 1) * g.half * 0.75;
          p.x = g.x + t * DX + s * DY;
          p.y = g.y + t * DY - s * DX;
        } else {
          p.x = Math.random() * W;
          p.y = Math.random() * H;
        }
        if(p.x > 0 && p.x < W && p.y > 0 && p.y < H) break;
      }
      p.r  = 0.45 + Math.random() * 1.1;
      p.vx = (Math.random() - 0.5) * 6;
      p.vy = (Math.random() - 0.3) * 5;
      p.ph = Math.random() * 6.2832;
      p.tw = 0.4 + Math.random() * 0.9;
      return p;
    }
    var tint = 0;
    function draw(dt, now){
      var want = root.classList.contains('lw-blue') ? 1 : 0;
      tint += (want - tint) * Math.min(dt * 2.5, 1);
      ctx.fillStyle = 'rgb(' + Math.round(228 - 118 * tint) + ',' + Math.round(236 - 76 * tint) + ',255)';
      ctx.clearRect(0, 0, W, H);
      for(var i = 0; i < parts.length; i++){
        var p = parts[i];
        p.x += (p.vx + Math.sin(now * 0.0004 + p.ph) * 2.2) * dt;
        p.y += p.vy * dt;
        if(p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20){ spawn(p); continue; }
        var a = (0.035 + light(p.x, p.y) * 0.62) * (0.65 + 0.35 * Math.sin(now * 0.0012 * p.tw + p.ph));
        if(a < 0.02) continue;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function loop(now){
      raf = requestAnimationFrame(loop);
      if(now - prev < 40) return;
      if(window.__scrolling){ prev = now; return; }
      var dt = prev ? Math.min((now - prev) / 1000, 0.1) : 0.033;
      prev = now;
      draw(dt, now);
    }
    function start(){ if(!raf && !reduce){ prev = 0; raf = requestAnimationFrame(loop); } }
    function stop(){ if(raf){ cancelAnimationFrame(raf); raf = 0; } }

    measure();
    for(var i = 0, n = coarse ? 24 : (W < 768 ? 34 : 64); i < n; i++) parts.push(spawn({}));
    if(reduce) draw(0, 0); else start();
    d.addEventListener('visibilitychange', function(){ if(d.hidden) stop(); else start(); });
    var scrollIdle;
    window.addEventListener('scroll', function(){
      window.__scrolling = true;
      clearTimeout(scrollIdle);
      scrollIdle = setTimeout(function(){ window.__scrolling = false; }, 180);
    }, { passive:true });
    var lastW = W, rzd;
    window.addEventListener('resize', function(){
      clearTimeout(rzd);
      rzd = setTimeout(function(){
        measure();
        if(W !== lastW){ lastW = W; parts.forEach(spawn); }
        if(reduce) draw(0, 0);
      }, 160);
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
