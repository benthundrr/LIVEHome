/* THUNDRR — TikTok LIVE Guides
   Motion plays once and only on scroll; nothing re-renders on tap or typing. */
(function(){
  window.__guides=true;
  var d=document,root=d.documentElement,b=d.body;
  root.classList.add('js');
  var nav=d.getElementById('nav'),sheet=d.getElementById('sheet'),burger=d.getElementById('burger'),prog=d.getElementById('prog');
  var CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var CROSS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var REVEAL='.take,.prose ul.cards,.prose ul.stats,.tbl,.prose blockquote,.prose ol.steps,.graphic,.cta-inline,.g-bio,.faq,.g-card,.cta';
  var lastY=window.pageYOffset,tick=false,pend=[],cur='';

  /* titles: words lift in; screen readers get the plain heading text */
  function split(el){
    if(el.getAttribute('data-split'))return;
    el.setAttribute('aria-label',el.textContent.replace(/\s+/g,' ').trim());
    var k=0,step=el.tagName==='H1'?80:45,frag=d.createDocumentFragment();
    function words(text,accent){
      text.split(/(\s+)/).forEach(function(w){
        if(!w)return;
        if(/^\s+$/.test(w)){frag.appendChild(d.createTextNode(' '));return;}
        var o=d.createElement('span');o.className='kw';o.setAttribute('aria-hidden','true');
        var i=d.createElement('span');i.className='kwi'+(accent?' accent':'');i.style.setProperty('--k',(k++*step)+'ms');i.textContent=w;
        o.appendChild(i);frag.appendChild(o);
      });
    }
    [].slice.call(el.childNodes).forEach(function(n){
      if(n.nodeType===3)words(n.textContent,false);
      else if(n.nodeType===1)words(n.textContent,n.classList.contains('accent'));
    });
    el.textContent='';el.appendChild(frag);
    el.setAttribute('data-split','1');
  }

  function countUp(ul){
    [].forEach.call(ul.querySelectorAll('strong'),function(s){
      var m=/^(\d+)(.*)$/.exec(s.getAttribute('data-v')||'');if(!m)return;
      var n=+m[1],suf=m[2],t0=null;if(!n){s.textContent=m[0];return;}
      function f(t){if(!t0)t0=t;var p=Math.min(1,(t-t0)/1100),e=1-Math.pow(1-p,3);
        s.textContent=Math.round(n*e)+suf;if(p<1)requestAnimationFrame(f);}
      requestAnimationFrame(f);
    });
  }

  /* tables: scroll wrapper + Yes/No icons on {: .compare} */
  [].forEach.call(d.querySelectorAll('.prose table'),function(t){
    var w=d.createElement('div');w.className='tbl';t.parentNode.insertBefore(w,t);w.appendChild(t);
    if(t.classList.contains('compare'))[].forEach.call(t.querySelectorAll('td'),function(td){
      var v=td.textContent.trim().toLowerCase();
      if(v==='yes')td.innerHTML='<span class="ic-yes">'+CHECK+'</span><span class="sr">Yes</span>';
      if(v==='no')td.innerHTML='<span class="ic-no">'+CROSS+'</span><span class="sr">No</span>';
    });
  });
  /* stats count up from zero */
  [].forEach.call(d.querySelectorAll('.prose ul.stats strong'),function(s){
    var v=s.textContent.trim(),m=/^(\d+)(.*)$/.exec(v);s.setAttribute('data-v',v);
    if(m&&+m[1])s.textContent='0'+m[2];
  });

  var h1=d.querySelector('.post-h1');
  [].forEach.call(d.querySelectorAll('.kin,.prose h2'),function(h){h.classList.add('kin');split(h);});

  var io=null;
  function reveal(n){
    if(n.classList.contains('in'))return;
    n.classList.add('in');if(io)io.unobserve(n);
    var i=pend.indexOf(n);if(i>-1)pend.splice(i,1);
    if(n.matches('ul.stats'))countUp(n);
    if(n.matches('.cta')){var h=n.querySelector('.kin');if(h)h.classList.add('in');}
  }
  pend=[].slice.call(d.querySelectorAll(REVEAL+',.prose h2'));
  if('IntersectionObserver' in window){
    io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)reveal(e.target);});},
      {rootMargin:'0px 0px -8% 0px',threshold:.12});
    pend.forEach(function(n){io.observe(n);});
  }else{pend.slice().forEach(reveal);}
  requestAnimationFrame(function(){requestAnimationFrame(function(){if(h1)h1.classList.add('in');});});

  /* contents: highlight the section you're reading */
  var heads=[].slice.call(d.querySelectorAll('.prose h2[id]'));
  var links=[].slice.call(d.querySelectorAll('[data-toc] a'));
  var now=d.getElementById('tocNow');

  function frame(){
    var y=window.pageYOffset,vh=window.innerHeight,max=root.scrollHeight-vh;
    nav.classList.toggle('is-stuck',y>24);
    if(y>520&&y>lastY+6&&!sheet.classList.contains('is-open')){nav.classList.add('is-hidden');b.classList.add('nav-off');}
    else if(y<lastY-6||y<200){nav.classList.remove('is-hidden');b.classList.remove('nav-off');}
    prog.style.width=(max>0?Math.min(100,y/max*100):0)+'%';
    for(var j=pend.length-1;j>=0;j--){if(pend[j].getBoundingClientRect().bottom<0)reveal(pend[j]);}
    if(heads.length){
      var id=heads[0].id;
      for(var i=0;i<heads.length;i++){if(heads[i].getBoundingClientRect().top<vh*.3)id=heads[i].id;}
      if(id!==cur){
        cur=id;
        links.forEach(function(l){l.classList.toggle('is-on',l.getAttribute('href')==='#'+id);});
        if(now){var h=d.getElementById(id);now.textContent=h.getAttribute('aria-label')||h.textContent;}
      }
    }
    lastY=y;tick=false;
  }

  function setSheet(open){
    sheet.classList.toggle('is-open',open);burger.classList.toggle('is-on',open);
    burger.setAttribute('aria-expanded',open?'true':'false');b.classList.toggle('is-locked',open);
  }
  function setToc(open){b.classList.toggle('toc-open',open);b.classList.toggle('is-locked',open);}

  window.addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(frame);}},{passive:true});
  window.addEventListener('resize',function(){requestAnimationFrame(frame);});
  burger.addEventListener('click',function(){setSheet(!sheet.classList.contains('is-open'));});
  d.addEventListener('click',function(e){
    var t=e.target;
    if(t.closest('[data-open-toc]')){setToc(true);return;}
    if(t.closest('[data-close-toc]')){setToc(false);return;}
    var a=t.closest('a[href^="#"]');if(!a)return;
    var h=a.getAttribute('href'),el=h.length>1&&d.getElementById(h.slice(1));
    if(!el)return;
    e.preventDefault();setSheet(false);setToc(false);
    window.scrollTo({top:el.getBoundingClientRect().top+window.pageYOffset-84,behavior:'smooth'});
    try{history.replaceState(null,'',h);}catch(err){}
  });
  d.addEventListener('keydown',function(e){if(e.key==='Escape'){setSheet(false);setToc(false);}});
  frame();
})();
