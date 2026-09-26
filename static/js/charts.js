/* Accessible SVG time-series charts. A missing month/year breaks the line. */
(function(root){
 const registry=new Map();
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:2});
 const monthNumber=d=>Number(d.slice(0,4))*12+Number(d.slice(5));
 function paint(el,series,options){
  const dates=[...new Set(series.flatMap(s=>s.points.map(p=>p.date)))].sort();
  const valid=series.flatMap(s=>s.points).filter(p=>Number.isFinite(p.value)&&(!options.log||p.value>0));
  if(dates.length<2||!valid.length){el.innerHTML='<div class="chart-loading">이 기간에는 그래프를 그릴 관측값이 부족합니다.</div>';return;}
  const W=Math.max(280,el.clientWidth),H=el.clientHeight||280,L=W<450?50:65,R=14,T=16,B=30;
  const transform=v=>options.log?Math.log10(v):v;
  let lo=Math.min(...valid.map(p=>transform(p.value))),hi=Math.max(...valid.map(p=>transform(p.value)));
  const pad=(hi-lo)*.07||1;lo-=pad;hi+=pad;
  if(options.zero&&!options.log)lo=Math.min(0,lo);
  if(!options.log&&valid.every(p=>p.value>=0))lo=Math.max(0,lo);
  const begin=monthNumber(dates[0]),end=monthNumber(dates.at(-1));
  const x=d=>L+(monthNumber(d)-begin)/(end-begin)*(W-L-R);
  const y=v=>H-B-(transform(v)-lo)/(hi-lo)*(H-T-B);
  const dateLabel=d=>options.annual?d.slice(0,4):d;
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(options.title||'추이')} · ${dates[0]} — ${dates.at(-1)}"><title>${esc(options.title||'추이')}</title>`;
  for(let i=0;i<=4;i++){
   const raw=lo+(hi-lo)*i/4,py=H-B-i/4*(H-T-B),v=options.log?10**raw:raw;
   svg+=`<line x1="${L}" x2="${W-R}" y1="${py}" y2="${py}" stroke="var(--border)" stroke-dasharray="3 5"/><text x="${L-8}" y="${py+3}" text-anchor="end" fill="var(--text-secondary)" font-size="10">${v.toLocaleString('ko-KR',{maximumFractionDigits:v<10?1:0})}</text>`;
  }
  const ticks=W<450?3:6;
  for(let i=0;i<ticks;i++){
   const d=dates[Math.round(i/(ticks-1)*(dates.length-1))];
   svg+=`<text x="${x(d)}" y="${H-5}" text-anchor="${i===0?'start':i===ticks-1?'end':'middle'}" fill="var(--text-secondary)" font-size="10">${dateLabel(d)}</text>`;
  }
  series.forEach(s=>{
   let segment=[],last=null;
   const flush=()=>{if(segment.length)svg+=`<polyline data-series="${esc(s.id||s.name)}" points="${segment.join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.id==='gold'?2.6:2}" stroke-linejoin="round"${s.dashed?' stroke-dasharray="6 3"':''}/>`;segment=[];};
   s.points.forEach(p=>{
    if(!Number.isFinite(p.value)||(options.log&&p.value<=0)){flush();last=null;return;}
    if(last&&monthNumber(p.date)-monthNumber(last)>(options.annual?12:1))flush();
    segment.push(`${x(p.date).toFixed(2)},${y(p.value).toFixed(2)}`);last=p.date;
   });flush();
   if(s.points.length<15)s.points.forEach(p=>{if(Number.isFinite(p.value)&&(!options.log||p.value>0))svg+=`<circle cx="${x(p.date)}" cy="${y(p.value)}" r="2.4" fill="${s.color}"/>`;});
  });
  svg+=`<line class="crosshair" x1="0" x2="0" y1="${T}" y2="${H-B}" stroke="var(--text-secondary)" stroke-dasharray="3 3" visibility="hidden"/></svg>`;
  el.innerHTML=svg;el.tabIndex=0;el.setAttribute('aria-label',`${options.title||'추이'}: 좌우 방향키로 시점 확인`);
  let cursor=dates.length-1;
  const maps=series.map(s=>new Map(s.points.map(p=>[p.date,p.value])));
  const show=()=>{
   const d=dates[cursor],line=el.querySelector('.crosshair');line.setAttribute('x1',x(d));line.setAttribute('x2',x(d));line.setAttribute('visibility','visible');
   const tooltip=document.getElementById(options.tooltip);
   if(tooltip)tooltip.textContent=`${dateLabel(d)} · `+series.map((s,i)=>`${s.name} ${maps[i].has(d)?fmt(maps[i].get(d))+(options.unit?' '+options.unit:''):'자료 없음'}`).join(' / ');
  };
  el.onpointermove=e=>{const px=e.clientX-el.getBoundingClientRect().left;cursor=dates.reduce((best,d,i)=>Math.abs(x(d)-px)<Math.abs(x(dates[best])-px)?i:best,0);show();};
  el.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();cursor=e.key==='Home'?0:e.key==='End'?dates.length-1:Math.max(0,Math.min(dates.length-1,cursor+(e.key==='ArrowRight'?1:-1)));show();};
 }
 const observer=new ResizeObserver(entries=>entries.forEach(({target})=>{const r=registry.get(target);if(r)paint(target,r.series,r.options);}));
 root.GoldChart={render(id,series,options={}){const el=document.getElementById(id);if(!el)return;if(!registry.has(el))observer.observe(el);registry.set(el,{series,options});paint(el,series,options);},clear(id,message){const el=document.getElementById(id);if(el){registry.delete(el);observer.unobserve(el);el.textContent=message;}}};
})(window);
