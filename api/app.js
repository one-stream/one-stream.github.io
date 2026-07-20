
function toggleTheme(){
  var cur=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',cur);
  try{localStorage.setItem('theme',cur);}catch(e){}
}
function togglePane(which){
  var r=document.documentElement;
  var attr=which==='nav'?'data-nav':'data-toc', key=which==='nav'?'navHidden':'tocHidden';
  if(r.getAttribute(attr)==='hidden'){r.removeAttribute(attr);try{localStorage.removeItem(key);}catch(e){}}
  else{r.setAttribute(attr,'hidden');try{localStorage.setItem(key,'1');}catch(e){}}
}
// guide switcher: populate from the deploy-root guides.json (absent = standalone)
(function(){
  var sel=document.getElementById('guide-select'); if(!sel) return;
  var base=document.body.getAttribute('data-base')||'';
  var cur=document.body.getAttribute('data-guide')||'';
  var root=base+'../';
  fetch(root+'guides.json').then(function(r){if(!r.ok)throw 0;return r.json();})
    .then(function(gs){
      if(!gs||!gs.length){sel.remove();return;}
      sel.innerHTML=gs.map(function(g){
        return '<option value="'+g.slug+'"'+(g.slug===cur?' selected':'')+'>'+g.title+'</option>';}).join('');
      sel.hidden=false;
      sel.addEventListener('change',function(){location.href=root+sel.value+'/index.html';});
    }).catch(function(){sel.remove();});
})();
(function(){
  var base=document.body.getAttribute('data-base')||'';
  var q=document.getElementById('q'), box=document.getElementById('results');
  var idx=null;
  function load(cb){ if(idx)return cb();
    fetch(base+'search-index.json').then(function(r){return r.json();})
      .then(function(d){idx=d;cb();}).catch(function(){idx=[];cb();}); }
  function esc(s){return s.replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  function rx(t){return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function snippet(text,terms){
    var lt=text.toLowerCase(),pos=-1;
    terms.forEach(function(t){var p=lt.indexOf(t); if(p>=0&&(pos<0||p<pos))pos=p;});
    if(pos<0)pos=0;
    var s=Math.max(0,pos-55),e=Math.min(text.length,pos+95);
    var f=(s>0?'…':'')+esc(text.slice(s,e))+(e<text.length?'…':'');
    terms.forEach(function(t){if(t)f=f.replace(new RegExp('('+rx(t)+')','ig'),'<mark>$1</mark>');});
    return f;
  }
  function run(){
    var raw=q.value.trim().toLowerCase();
    if(raw.length<2){box.hidden=true;box.innerHTML='';return;}
    var terms=raw.split(/\s+/);
    load(function(){
      var out=[];
      for(var i=0;i<idx.length;i++){
        var it=idx[i],hay=(it.t+' '+it.s+' '+it.x).toLowerCase(),ok=true,sc=0;
        for(var j=0;j<terms.length;j++){ if(hay.indexOf(terms[j])<0){ok=false;break;}
          if(it.t.toLowerCase().indexOf(terms[j])>=0)sc+=10;
          if(it.s.toLowerCase().indexOf(terms[j])>=0)sc+=4; }
        if(ok)out.push([sc,it]);
      }
      out.sort(function(a,b){return b[0]-a[0];});
      out=out.slice(0,60);
      if(!out.length){box.hidden=false;box.innerHTML='<div class="empty">No matches</div>';return;}
      box.innerHTML=out.map(function(p){var it=p[1];
        return '<a class="r" href="'+base+it.u+'#'+it.a+'" data-q="'+esc(q.value.trim())+'">'
          +'<span class="rc">'+esc(it.c)+(it.s?' › '+esc(it.s):'')+'</span>'
          +'<div class="rt">'+esc(it.t)+'</div><div class="rx">'+snippet(it.x,terms)+'</div></a>';
      }).join('');
      box.hidden=false;
    });
  }
  function deb(fn,ms){var t;return function(){clearTimeout(t);t=setTimeout(fn,ms);};}
  var active=-1;
  if(q){
    q.addEventListener('input',deb(run,140));
    q.addEventListener('keydown',function(e){
      var L=box.querySelectorAll('.r');
      if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(L.length-1,active+1);}
      else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,active-1);}
      else if(e.key==='Enter'){if(L[active])L[active].click();return;}
      else if(e.key==='Escape'){box.hidden=true;return;} else return;
      L.forEach(function(l){l.classList.remove('active');});
      if(L[active]){L[active].classList.add('active');L[active].scrollIntoView({block:'nearest'});}
    });
    document.addEventListener('click',function(e){
      if(!e.target.closest('.search-wrap'))box.hidden=true;
      var a=e.target.closest('.results .r');
      if(a){try{sessionStorage.setItem('docq',a.getAttribute('data-q')||'');}catch(_){}}
    });
  }
  // highlight searched terms on arrival + scroll to the section
  window.addEventListener('load',function(){
    var term; try{term=sessionStorage.getItem('docq');sessionStorage.removeItem('docq');}catch(_){}
    if(term){
      var target=null; if(location.hash){try{target=document.querySelector(decodeURIComponent(location.hash));}catch(_){}}
      var scope=target||document.querySelector('.content')||document.body;
      var terms=term.toLowerCase().split(/\s+/).filter(Boolean);
      if(terms.length){
        var re=new RegExp('('+terms.map(rx).join('|')+')','ig');
        var w=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,null),nodes=[],n;
        while((n=w.nextNode()))nodes.push(n);
        nodes.forEach(function(nd){
          if(!nd.nodeValue.trim()||/^(SCRIPT|STYLE|MARK)$/.test(nd.parentNode.nodeName))return;
          if(!re.test(nd.nodeValue))return; re.lastIndex=0;
          var sp=document.createElement('span'); sp.innerHTML=nd.nodeValue.replace(re,'<mark>$1</mark>');
          nd.parentNode.replaceChild(sp,nd);
        });
      }
      if(target)setTimeout(function(){target.scrollIntoView();},0);
    }
  });
  // scroll-spy: highlight current section in the right toc + left menu
  var secs=[].slice.call(document.querySelectorAll('.doc-section'));
  var tocMap={},menuMap={};
  document.querySelectorAll('.toc-list a').forEach(function(a){tocMap[a.getAttribute('href').slice(1)]=a;});
  document.querySelectorAll('.cat.open .s-link').forEach(function(a){menuMap[a.getAttribute('href').slice(1)]=a;});
  if(secs.length&&'IntersectionObserver'in window){
    var cur=null;
    var io=new IntersectionObserver(function(ents){
      ents.forEach(function(en){ if(en.isIntersecting)cur=en.target.id; });
      if(cur){
        Object.keys(tocMap).forEach(function(k){tocMap[k].classList.toggle('active',k===cur);});
        Object.keys(menuMap).forEach(function(k){menuMap[k].classList.toggle('active',k===cur);});
        var m=menuMap[cur]; if(m)m.scrollIntoView({block:'nearest'});
      }
    },{rootMargin:'-'+ (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navh'))||56) +'px 0px -70% 0px',threshold:0});
    secs.forEach(function(s){io.observe(s);});
  }
  // add a working copy button to every code block
  document.querySelectorAll('.sec-body pre').forEach(function(pre){
    var wrap=document.createElement('div'); wrap.className='codeblock';
    pre.parentNode.insertBefore(wrap,pre); wrap.appendChild(pre);
    var b=document.createElement('button'); b.className='copy-btn'; b.type='button'; b.textContent='Copy';
    b.addEventListener('click',function(){
      var txt=pre.innerText;
      var done=function(){b.textContent='Copied';b.classList.add('copied');
        setTimeout(function(){b.textContent='Copy';b.classList.remove('copied');},1400);};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,done);}
      else{var t=document.createElement('textarea');t.value=txt;document.body.appendChild(t);t.select();
        try{document.execCommand('copy');}catch(e){} document.body.removeChild(t);done();}
    });
    wrap.appendChild(b);
  });
  // resizable left nav + right TOC (drag the divider; width persists)
  (function(){
    var root=document.documentElement;
    function drag(handle,varName,compute,min,max){
      if(!handle)return;
      handle.addEventListener('mousedown',function(e){
        e.preventDefault(); handle.classList.add('active');
        var prevCur=document.body.style.cursor;
        document.body.style.userSelect='none'; document.body.style.cursor='col-resize';
        function mm(ev){var v=Math.min(max,Math.max(min,compute(ev))); root.style.setProperty(varName,v+'px');}
        function mu(){handle.classList.remove('active'); document.body.style.userSelect='';
          document.body.style.cursor=prevCur;
          document.removeEventListener('mousemove',mm); document.removeEventListener('mouseup',mu);
          try{localStorage.setItem(varName,getComputedStyle(root).getPropertyValue(varName).trim());}catch(_){}}
        document.addEventListener('mousemove',mm); document.addEventListener('mouseup',mu);
      });
      // double-click resets to the stylesheet default
      handle.addEventListener('dblclick',function(){root.style.removeProperty(varName);
        try{localStorage.removeItem(varName);}catch(_){}});
    }
    drag(document.querySelector('.rz-left'),'--sbw',function(e){return e.clientX;},180,560);
    drag(document.querySelector('.rz-right'),'--tocw',function(e){return window.innerWidth-e.clientX;},160,520);
  })();
  // close mobile sidebar after choosing a link
  document.querySelector('.sidebar')&&document.querySelector('.sidebar').addEventListener('click',function(e){
    if(e.target.closest('a'))document.body.classList.remove('sidebar-open');
  });
})();
