'use strict';
const $ = id => document.getElementById(id);
const format = (n, digits = 2) => Number.isFinite(n) ? n.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
const pct = n => Number.isFinite(n) ? `${n > 0 ? '+' : ''}${format(n)}%` : '—';
const sign = n => n > 0 ? 'up' : n < 0 ? 'down' : '';
const escapeText = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
const currentTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
// Ecosystem links carry the effective theme (and `from`) to the hub and sibling tools.
// The vendored vc-shell builds them from the registry; the static href is the fallback.
function syncEcosystemLinks(scope = document) {
  scope.querySelectorAll('a[data-vc-tool]').forEach(link => {
    const { vcTool: tool, vcCode: code, vcAsset: asset, vcView: view } = link.dataset;
    const shellHref = window.VCShell && window.VCShell.linkTo(tool, { code, asset, view });
    if (shellHref) { link.href = shellHref; return; }
    const url = new URL(link.href);
    url.searchParams.set('theme', currentTheme());
    link.href = url.href;
  });
}
// The inline vc-theme-boot block already applied ?theme / stored / system theme before paint.
if (!['light', 'dark'].includes(document.documentElement.dataset.theme)) document.documentElement.dataset.theme = currentTheme();
syncEcosystemLinks();
if (params.has('embed')) document.body.classList.add('embedded');
document.addEventListener('vc:themechange', () => syncEcosystemLinks());
$('theme').onclick = () => {
  const theme = currentTheme() === 'dark' ? 'light' : 'dark';
  if (window.VCShell) { window.VCShell.setTheme(theme); return; }
  document.documentElement.dataset.theme = theme;
  syncEcosystemLinks();
  try { localStorage.setItem('theme', theme); } catch (_) { /* Keep in-memory theme. */ }
};
let assets = [], period = 'all', selected = new Set(['gold', 'silver', 'bitcoin', 'dollar']), comparison, cursor = 0;
function spark(points, color) {
  const values = points.slice(-18).map(p => p.value), lo = Math.min(...values), hi = Math.max(...values);
  return `<svg class="spark" viewBox="0 0 80 30" aria-hidden="true"><polyline points="${values.map((v,i) => `${i/(values.length-1)*80},${27-(v-lo)/(hi-lo||1)*24}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.7"/></svg>`;
}
function renderCards() {
  $('overview').innerHTML = assets.map(a => {
    const latest = a.points.at(-1), previous = a.points.at(-2);
    const expected = new Date(`${latest.date}-01T00:00:00Z`); expected.setUTCMonth(expected.getUTCMonth() - 1);
    const delta = previous.date === expected.toISOString().slice(0,7) ? (latest.value / previous.value - 1) * 100 : null;
    return `<article class="market-card"><div class="card-label"><span class="dot" style="background:${a.color}"></span>${escapeText(a.name)}</div><div class="symbol">${escapeText(a.symbol)} · ${a.id === 'gold' || a.id === 'silver' ? '현물 월평균' : '월평균'}</div><div class="price">${format(latest.value)}</div><div class="unit">${escapeText(a.unit)}</div><div class="monthly-change ${sign(delta)}">${pct(delta)} <span class="unit">전월 대비</span></div><div class="card-date">${latest.date} 월평균</div>${spark(a.points,a.color)}</article>`;
  }).join('');
  $('source-links').innerHTML = assets.map(a => `<a target="_blank" rel="noopener noreferrer" href="${escapeText(a.source)}">${escapeText(a.description)}<span>↗</span></a>`).join('');
  $('legend').innerHTML = assets.map(a => `<button data-asset="${a.id}" aria-pressed="${selected.has(a.id)}"><span class="dot" style="background:${a.color}"></span>${escapeText(a.name)}</button>`).join('');
}
function renderGoldHistory() {
  const gold=assets.find(a=>a.id==='gold'), points=GoldMetrics.clip(gold.points,$('gold-period').value);
  $('gold-range').textContent=`${points[0].date} — ${points.at(-1).date}`;
  GoldChart.render('gold-long-chart',[{...gold,points}],{title:'금 현물 월평균 가격',log:$('gold-log').checked,unit:'USD/oz',tooltip:'gold-long-tip'});
}
function renderRatios() {
  const byId=id=>assets.find(a=>a.id===id);
  for(const [id,numerator,denominator,name,unit] of [['gold-silver','gold','silver','금/은','배'],['btc-gold','bitcoin','gold','BTC/금','oz/BTC']]){
    const points=GoldMetrics.clip(GoldMetrics.ratio(byId(numerator),byId(denominator)),$('ratio-period').value);
    $(id+'-value').textContent=points.length?`${format(points.at(-1).value)} ${unit}`:'—';
    $(id+'-tip').textContent=points.length?`${points[0].date} — ${points.at(-1).date} · 포인터/방향키로 조회`:'자료 없음';
    GoldChart.render(id+'-chart',[{id,name,color:byId(numerator).color,points}],{title:name+' 비율 추이',unit,tooltip:id+'-tip'});
  }
}
function render() {
  const alignment=$('alignment').value;
  comparison=GoldMetrics.compare(assets.filter(a=>selected.has(a.id)),period,alignment);
  const {dates,series}=comparison;
  document.querySelectorAll('[data-period]').forEach(b=>{b.classList.toggle('selected',b.dataset.period===period);b.setAttribute('aria-pressed',b.dataset.period===period);});
  document.querySelectorAll('[data-asset]').forEach(b=>b.setAttribute('aria-pressed',selected.has(b.dataset.asset)));
  const isReturn=$('mode').value==='return';$('log').disabled=isReturn;if(isReturn)$('log').checked=false;
  $('axis-label').textContent=isReturn?'가격 변동률 · %':`지수 · 각 자산 첫값 100${$('log').checked?' · 로그 축':''}`;
  $('download').disabled=dates.length<2;
  if(dates.length<2){GoldChart.clear('chart','비교할 관측값이 부족합니다.');$('performance').innerHTML='';$('range').textContent='자료 없음';return;}
  $('range').textContent=`${dates[0]} — ${dates.at(-1)} · ${dates.length}개 ${alignment==='common'?'공통 ':''}월`;
  $('comparison-note').textContent=alignment==='common'?'모든 선택 자산에 값이 있는 공통 월만 비교합니다. 금·은은 현물 월평균이며 투자 총수익률이 아닙니다.':'각 자산의 관측 시작점을 100으로 둡니다. 시작일이 서로 달라 같은 기간 수익률 비교가 아닙니다. 정확한 성과 비교는 “공통 기간만 비교”를 선택하세요. 자료가 없는 구간은 비워 둡니다.';
  $('performance').innerHTML=series.map(s=>`<tr><td><span class="dot" style="background:${s.color}"></span>${escapeText(s.name)}</td><td>${s.start||'—'} — ${s.end||'—'}</td><td>${format(s.points[0]?.value)}</td><td>${format(s.points.at(-1)?.value)}</td><td class="${sign(s.change)}">${pct(s.change)}</td><td class="${sign(s.cagr)}">${pct(s.cagr)}</td><td class="${sign(s.drawdown)}">${pct(s.drawdown)}</td></tr>`).join('');
  const chartSeries=series.map(s=>({...s,points:dates.flatMap((date,i)=>s.indexed[i]===null?[]:[{date,value:s.indexed[i]-(isReturn?100:0)}])}));
  GoldChart.render('chart',chartSeries,{title:'자산별 장기 가격 비교',log:$('log').checked,unit:isReturn?'%':'',tooltip:'tooltip'});
  $('tooltip').textContent='차트 위에 포인터를 올리거나 방향키로 월별 값을 확인하세요.';
}
$('gold-period').onchange=$('gold-log').onchange=()=>{if(assets.length)renderGoldHistory();};
$('ratio-period').onchange=()=>{if(assets.length)renderRatios();};
$('alignment').onchange=()=>{if(assets.length)render();};
$('periods').onclick = e => { const button = e.target.closest('[data-period]'); if(button && assets.length){period=button.dataset.period;render();} };
$('legend').onclick = e => {
  const button = e.target.closest('[data-asset]'); if(!button) return;
  const id = button.dataset.asset;
  if(selected.has(id)) { if(selected.size === 1) { $('tooltip').textContent='최소 한 개의 자산을 선택해야 합니다.'; return; } selected.delete(id); } else selected.add(id);
  render();
};
$('mode').onchange = $('log').onchange = () => { if(assets.length) render(); };
$('download').onclick = () => {
  const rows = [['month', ...comparison.series.map(s => `${s.symbol} (${s.unit})`)], ...comparison.dates.map((d,i)=>[d,...comparison.series.map(s=>s.values[i]??'')])];
  const csv = '\ufeff' + rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a'); a.href=url;a.download=`gold-comparison-${comparison.dates[0]}-${comparison.dates.at(-1)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if(entry.isIntersecting) document.querySelectorAll('.tabs a').forEach(a=>a.classList.toggle('active',a.hash===`#${entry.target.id}`)); }); },{rootMargin:'-10% 0px -65% 0px'});
document.querySelectorAll('section[id]').forEach(section=>observer.observe(section));
async function loadHistory() {
  try {
    const snapshot=await GoldData.load();
    const data=snapshot.history;
    if (!Array.isArray(data.assets) || data.assets.length !== 5 || data.assets.some(a => !a.points?.length || a.points.some(p=>!Number.isFinite(p.value)||p.value<=0))) throw new Error('Invalid data');
    assets = data.assets; renderCards();render();renderGoldHistory();renderRatios();
    // Daily runs with identical content are not republished, so publishedAt is the last real change.
    $('updated').textContent = `자료 발행 ${new Date(snapshot.publishedAt).toLocaleString('ko-KR', {timeZone:'Asia/Seoul'})} KST · finance-pi`;
    $('updated').title = '매일 확인하고 내용이 바뀐 날에만 새로 발행합니다.';
    const latest = assets.map(a=>a.points.at(-1).date).sort()[0];
    const age = Date.now() - Date.parse(latest+'-01');
    $('status').textContent = `${latest}까지의 월평균 가격 · finance-pi 경유 · 실시간 시세가 아닙니다.${age > 100*86400000 ? ' 데이터가 오래되었습니다. 최신 발표와 갱신 상태를 확인하세요.' : ''}`;
  } catch (error) {
    $('status').textContent = 'finance-pi에서 가격 데이터를 불러오지 못했습니다. 발행 데이터와 연결 상태를 확인하세요.';
    const button = document.createElement('button'); button.textContent='다시 시도';button.onclick=loadHistory;$('status').append(' ',button);
    GoldChart.clear('chart','가격 데이터 없음');GoldChart.clear('gold-long-chart','가격 데이터 없음');$('updated').textContent = '가격 데이터 로드 실패';
  }
}
loadHistory();
