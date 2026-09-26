/* Pure time-series calculations. Missing observations are never filled. */
(function (root) {
  function stats(points) {
    if (!points.length) return {change:null,cagr:null,drawdown:null,start:null,end:null};
    const first=points[0], last=points.at(-1);
    const years=(Date.parse(last.date+'-01')-Date.parse(first.date+'-01'))/(365.25*86400000);
    let peak=first.value, drawdown=0;
    points.forEach(p=>{peak=Math.max(peak,p.value);if(peak>0)drawdown=Math.min(drawdown,p.value/peak-1);});
    return {change:first.value>0?(last.value/first.value-1)*100:null,cagr:years>0&&first.value>0?(Math.pow(last.value/first.value,1/years)-1)*100:null,drawdown:drawdown*100,start:first.date,end:last.date};
  }
  function windowDates(dates,period) {
    if(!dates.length||period==='all')return dates;
    const [year,month]=dates.at(-1).split('-');
    const cutoff=`${Number(year)-Number(period)}-${month}`;
    return dates.filter(d=>d>=cutoff);
  }
  function compare(assets, period, alignment='independent') {
    if(!assets.length)return {dates:[],series:[]};
    const maps=assets.map(a=>new Map(a.points.map(p=>[p.date,p.value])));
    let dates=[...new Set(assets.flatMap(a=>a.points.map(p=>p.date)))].sort();
    if(alignment==='common')dates=dates.filter(d=>maps.every(m=>m.has(d)));
    dates=windowDates(dates,period);
    const series=assets.map((a,i)=>{
      const points=dates.filter(d=>maps[i].has(d)).map(d=>({date:d,value:maps[i].get(d)}));
      const first=points[0]?.value;
      const values=dates.map(d=>maps[i].get(d)??null);
      return {...a,points,values,indexed:values.map(v=>v!==null&&first>0?v/first*100:null),...stats(points)};
    });
    return {dates,series};
  }
  function ratio(numerator,denominator) {
    const map=new Map(denominator.points.map(p=>[p.date,p.value]));
    return numerator.points.filter(p=>map.get(p.date)>0).map(p=>({date:p.date,value:p.value/map.get(p.date)}));
  }
  function clip(points,period) {
    const dates=new Set(windowDates(points.map(p=>p.date),period));return points.filter(p=>dates.has(p.date));
  }
  root.GoldMetrics={compare,ratio,clip,stats};
  if(typeof module!=='undefined')module.exports=root.GoldMetrics;
})(typeof window!=='undefined'?window:globalThis);
