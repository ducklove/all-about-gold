const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compare, ratio } = require('../static/js/metrics.js');
const asset = (id, pairs) => ({id,points:pairs.map(([date,value])=>({date,value}))});
test('aligns common months and never invents missing observations',()=>{
 const result=compare([asset('gold',[['2000-01',10],['2020-01',20],['2021-01',30]]),asset('btc',[['2020-01',100],['2020-06',90],['2021-01',200]])],'all','common');
 assert.deepEqual(result.dates,['2020-01','2021-01']);assert.deepEqual(result.series.map(s=>s.indexed),[[100,150],[100,200]]);
});
test('uses calendar duration for annualization and running peaks for drawdown',()=>{
 const s=compare([asset('a',[['2020-01',100],['2020-06',200],['2021-01',100],['2022-01',121]])],'all').series[0];
 assert.ok(Math.abs(s.cagr-10)<.02);assert.equal(s.drawdown,-50);assert.ok(Math.abs(s.change-21)<1e-9);
});
test('clips the selected window relative to actual latest shared month',()=>{
 const r=compare([asset('a',[['2020-01',1],['2021-01',2],['2022-01',3],['2023-01',4]])],'1');
 assert.deepEqual(r.dates,['2022-01','2023-01']);assert.equal(r.series[0].indexed[0],100);
});
test('empty selection and one observation are safe',()=>{
 assert.deepEqual(compare([],'all'),{dates:[],series:[]});assert.equal(compare([asset('a',[['2020-01',1]])],'all').series[0].cagr,null);
});
test('published history is ordered, unique and positive; research sources are attributed',()=>{
 const fs=require('node:fs');const d=JSON.parse(fs.readFileSync('data/history.json'));
 for(const a of d.assets){assert.ok(a.points.length>=24);assert.equal(new Set(a.points.map(p=>p.date)).size,a.points.length);assert.deepEqual(a.points.map(p=>p.date),a.points.map(p=>p.date).sort());assert.ok(a.points.every(p=>p.value>0&&Number.isFinite(p.value)));}
 const research=JSON.parse(fs.readFileSync('data/research.json'));
 assert.equal(research.reserves.length,6);for(const r of research.reserves)assert.ok(r.source.startsWith('https://'));
 assert.equal(new Set(research.etfs.map(e=>e.type)).size,3);
 for(const r of research.supply.rows)assert.ok(Math.abs(r.mining+r.recycled+r.hedging-r.total)<.11);
});

test('independent histories keep gold before bitcoin with null values',()=>{
 const r=compare([asset('gold',[['1960-01',35],['2015-01',1200]]),asset('btc',[['2015-01',250]])],'all');
 assert.equal(r.dates[0],'1960-01');assert.deepEqual(r.series[1].values,[null,250]);assert.deepEqual(r.series[1].indexed,[null,100]);
});
test('ratios intersect only their own pair and never fill missing values',()=>{
 const result=ratio(asset('a',[['1960-01',35],['2015-01',100],['2016-01',120]]),asset('b',[['2015-01',20],['2016-01',0]]));
 assert.deepEqual(result,[{date:'2015-01',value:5}]);
});
