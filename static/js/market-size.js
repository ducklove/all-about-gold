/* finance-pi owns every calculation; this module formats annual observations. */
(function(root) {
  let data;
  const colors = {gold:'#b68a25', debt:'#5c80d9', flow:'#39a59b'};
  const series = (key, name, color, period, scale = 1, dashed = false) => ({
    id:key, name, color, dashed,
    points:GoldMetrics.clip(data[key], period).map(p=>({date:p.date,value:p.value/scale}))
  });
  function summary(id, items) {
    $(id).innerHTML = items.map(([label,value,unit]) => `<div><span>${escapeText(label)}</span><strong>${escapeText(value)}<small> ${escapeText(unit)}</small></strong></div>`).join('');
  }
  function renderValue() {
    const period=$('market-size-period').value;
    GoldChart.render('market-cap-chart', [
      series('marketCap','금 전체가치 · 추정',colors.gold,period,1e12,true),
      series('usDebt','미 연방 총부채',colors.debt,period,1e12)
    ], {title:'금 추정 시가총액과 미 연방 총부채',unit:'조 USD',annual:true,
      zero:true,log:$('market-size-log').checked,tooltip:'market-cap-tip'});
    GoldChart.render('gold-debt-chart',[
      series('goldDebtRatioPct','금 가치 / 미 연방 총부채',colors.gold,period)
    ],{title:'금 가치 / 미 연방 총부채 비율',unit:'%',annual:true,zero:true,tooltip:'gold-debt-tip'});
    $('market-cap-tip').textContent = '금은 1960년부터 · 부채는 1993년부터 · 명목 달러 기준';
    $('gold-debt-tip').textContent = '금 추정가치 ÷ 미 연방 총부채 × 100 · 두 자료가 있는 연도만';
  }
  function renderStock() {
    const period=$('stock-period').value;
    GoldChart.render('gold-stock-chart',[
      series('stock','전체 지상재고 · 재구성 추정',colors.gold,period,1,true)
    ],{title:'전체 금 지상재고 추정량',unit:'t',annual:true,zero:true,tooltip:'gold-stock-tip'});
    GoldChart.render('mining-stock-chart',[
      series('miningStockRatioPct','연간 채굴량 / 연말 지상재고',colors.flow,period)
    ],{title:'전체 금 대비 연간 채굴량',unit:'%',annual:true,zero:true,tooltip:'mining-stock-tip'});
    $('gold-stock-tip').textContent = `${data.stock[0].date.slice(0,4)}년부터 · ${data.inputs.stockAnchor.year}년 WGC 추정량을 기준으로 과거 수량을 역산`;
    $('mining-stock-tip').textContent = 'USGS 연간 채굴량 ÷ 추정 연말 지상재고 × 100';
  }
  function rows() {
    const maps = Object.fromEntries(['mining','marketCap','usDebt','goldDebtRatioPct','miningStockRatioPct'].map(k=>[k,new Map(data[k].map(p=>[p.date,p.value]))]));
    return data.stock.map(p=>({date:p.date,stock:p.value,...Object.fromEntries(Object.entries(maps).map(([k,m])=>[k,m.get(p.date)??null]))}));
  }
  function renderTable() {
    $('market-size-rows').innerHTML = rows().slice().reverse().map(r=>
      `<tr><td>${r.date.slice(0,4)}</td><td>${format(r.stock,0)}</td><td>${format(r.mining,0)}</td><td>${r.marketCap===null?'—':format(r.marketCap/1e12)}</td><td>${r.usDebt===null?'—':format(r.usDebt/1e12)}</td><td>${format(r.goldDebtRatioPct)}</td><td>${format(r.miningStockRatioPct)}</td></tr>`
    ).join('');
  }
  $('download-market-size').onclick = () => {
    if (!data) return;
    const headers=['year','gold_stock_reconstructed_tonnes','usgs_mining_tonnes','gold_value_proxy_usd','us_federal_debt_face_usd','gold_to_debt_pct','mining_to_end_year_stock_pct'];
    const csv=[headers, ...rows().map(r=>[r.date.slice(0,4),r.stock,r.mining,r.marketCap,r.usDebt,r.goldDebtRatioPct,r.miningStockRatioPct])].map(r=>r.map(v=>v??'').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='gold-market-size-estimates.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('market-size-period').onchange=$('market-size-log').onchange=()=>{if(data)renderValue();};
  $('stock-period').onchange=()=>{if(data)renderStock();};
  root.GoldMarketSize = {
    render(value) {
      if (!value || value.schemaVersion!==1) throw Error('Missing market-size research');
      data=value;
      const last=data.goldDebtRatioPct.at(-1), year=last.date.slice(0,4);
      const at=(key,date=last.date)=>data[key].find(p=>p.date===date)?.value;
      summary('market-size-summary',[
        [`금 추정 시가총액 · ${year}`,format(at('marketCap')/1e12),'조 USD'],
        [`미 연방 총부채 · ${year}`,format(at('usDebt')/1e12),'조 USD'],
        [`금 / 미 연방 총부채 · ${year}`,format(last.value),'%']
      ]);
      const stock=data.stock.at(-1), stockYear=stock.date.slice(0,4);
      summary('stock-summary',[
        [`전체 금 지상재고 · ${stockYear}`,format(stock.value,0),'t'],
        [`USGS 연간 채굴량 · ${stockYear}`,format(at('mining',stock.date),0),'t'],
        ['채굴량 / 연말 지상재고',format(at('miningStockRatioPct',stock.date)),'%'],
        ['재고 / 연간 채굴량',format(at('stockToFlowYears',stock.date),1),'년']
      ]);
      $('market-size-status').textContent=`연간 추정치 · 재고 기준 ${data.inputs.stockAnchor.year}년 · 입력 검토 ${data.inputs.reviewedAt}`;
      renderValue();renderStock();renderTable();
    },
    fail() {
      $('market-size-status').textContent='finance-pi의 시장 규모 자료를 불러오지 못했습니다. 채굴·공급 영역에서 다시 시도할 수 있습니다.';
      for(const id of ['market-cap-chart','gold-debt-chart','gold-stock-chart','mining-stock-chart'])GoldChart.clear(id,'시장 규모 데이터 없음');
    }
  };
})(window);
