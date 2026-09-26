'use strict';
let research, trends, etfType = '전체';
function renderMining() {
  const year = $('mining-year').value;
  const rows = [...research.mining.countries].sort((a,b)=>b[year]-a[year]);
  $('mining-bars').innerHTML = rows.map(c=>`<div class="bar-row"><span>${escapeText(c.name)}</span><div class="bar-track"><div style="width:${c[year]/rows[0][year]*100}%"></div></div><strong>${format(c[year],0)}<small> t</small></strong></div>`).join('');
  $('mining-world').textContent = `USGS 세계 채굴량: ${year}년 ${format(research.mining.world[year],0)}t${year==='2025'?' (추정)':''}. 국가별 수치는 반올림 및 추정치를 포함하며, 기타 국가는 위 목록에서 제외했습니다.`;
}
function renderReserves() {
  const query = $('country-search').value.trim();
  const rows = research.reserves.filter(r=>r.country.includes(query));
  $('reserve-rows').innerHTML = rows.length ? rows.map(r=>`<tr><td><strong>${escapeText(r.country)}</strong><div class="reserve-institution">${escapeText(r.institution)}</div></td><td>${format(r.tonnes,1)}</td><td>${r.asOf || '기준일 미표기'}${!r.asOf?'<div class="reserve-institution">확인 2026-09-26</div>':''}</td><td><a href="${escapeText(r.source)}" target="_blank" rel="noopener noreferrer" title="${escapeText(r.note||r.institution)}">공식 자료 ↗</a></td></tr>`).join('') : '<tr><td colspan="4">검색한 국가가 없습니다. 수록된 6개국에서 검색하세요.</td></tr>';
}
function renderEtfs() {
  const market = $('etf-market').value;
  const rows = research.etfs.filter(e=>(etfType==='전체'||e.type===etfType)&&(market==='전체'||e.market===market));
  document.querySelectorAll('[data-type]').forEach(b=>{b.classList.toggle('selected',b.dataset.type===etfType);b.setAttribute('aria-pressed',b.dataset.type===etfType);});
  $('etf-cards').innerHTML = rows.length ? rows.map(e=>`<article class="etf-card"><div class="etf-top"><strong>${escapeText(e.ticker)}</strong><span>${escapeText(e.type)} · ${e.market}</span></div><h3>${escapeText(e.name)}</h3><div class="etf-exposure">${escapeText(e.exposure)} · ${e.currency}</div><p>${escapeText(e.note)}</p><a href="${escapeText(e.source)}" target="_blank" rel="noopener noreferrer">운용사 / 거래소 자료 ↗</a></article>`).join('') : '<p class="note">선택한 시장·유형의 수록 상품이 없습니다.</p>';
}
$('mining-year').onchange = ()=>{if(research)renderMining();};
$('country-search').oninput = ()=>{if(research)renderReserves();};
$('etf-market').onchange = ()=>{if(research)renderEtfs();};
$('etf-types').onclick = e=>{const b=e.target.closest('[data-type]');if(b&&research){etfType=b.dataset.type;renderEtfs();}};
async function loadResearch() {
  try {
    const snapshot=await GoldData.load();
    research=snapshot.research;trends=snapshot.trends;
    GoldMarketSize.render(snapshot.marketSize);
    const last = research.supply.rows.at(-1), prev=research.supply.rows.at(-2);
    $('supply-summary').innerHTML = [['신규 채굴량','mining'],['재활용 공급','recycled'],['순생산자 헤징','hedging'],['총공급','total']].map(([name,key])=>`<div><span>${name} · ${last.year}</span><strong>${format(last[key],1)}<small> t</small></strong><p>${key==='hedging'?'생산자 선도매도 등의 순변화':`전년 대비 ${pct((last[key]/prev[key]-1)*100)}`}</p></div>`).join('');
    renderMining();renderReserves();renderEtfs();
    $('reserve-country').innerHTML='<option value="all">6개국 함께</option>'+trends.reserves.map(r=>`<option value="${r.id}">${escapeText(r.name)}</option>`).join('');
    renderMiningTrend();renderReserveTrend();
    $('research-status').textContent=`자료 검토 ${research.reviewedAt} · 발표 자료를 바탕으로 관리하는 스냅샷이며 자동 실시간 갱신되지 않습니다.`;
  } catch(error) {
    GoldMarketSize.fail();
    $('research-status').textContent='finance-pi의 공급·보유량·ETF 자료를 불러오지 못했습니다. ';
    const b=document.createElement('button');b.textContent='다시 시도';b.onclick=loadResearch;$('research-status').append(b);
  }
}
loadResearch();

function renderMiningTrend(){
 const series=trends.mining.filter(s=>s.id===$('mining-region').value);
 GoldChart.render('mining-trend',series,{title:'연간 금 채굴량',unit:'t',annual:true,zero:true,tooltip:'mining-trend-tip'});
 $('mining-trend-tip').textContent='1900 — 2022 · 포인터/방향키로 연도별 채굴량 확인';
}
function renderReserveTrend(){
 const selected=$('reserve-country').value,series=trends.reserves.filter(s=>selected==='all'||s.id===selected);
 GoldChart.render('reserves-trend',series,{title:'국가별 금 보유량',unit:'t',annual:true,zero:true,log:$('reserve-log').checked,tooltip:'reserves-trend-tip'});
 $('reserve-legend').innerHTML=series.map(s=>`<a href="${escapeText(s.source)}" target="_blank" rel="noopener noreferrer"><span class="dot" style="background:${s.color}"></span> ${escapeText(s.name)} ↗</a>`).join('');
 $('reserves-trend-tip').textContent='국가를 선택하면 해당 국가의 변화 폭을 자세히 볼 수 있습니다.';
}
$('mining-region').onchange=()=>{if(trends)renderMiningTrend();};
$('reserve-country').onchange=$('reserve-log').onchange=()=>{if(trends)renderReserveTrend();};
