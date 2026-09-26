const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:8765/');
 for(const id of ['gold-long-chart','chart','gold-silver-chart','btc-gold-chart','mining-trend','reserves-trend'])await page.waitForSelector(`#${id} svg`).catch(async error=>{console.error({chart:id,errors,status:await page.locator('#status').textContent(),research:await page.locator('#research-status').textContent()});throw error;});
 assert.equal(requests.filter(u=>u.endsWith('/api/gold')).length,1);
 assert.ok(requests.every(u=>u.startsWith('http://127.0.0.1:8765/')));
 assert.match(await page.locator('#range').textContent(),/1960-01/);
 await page.locator('#chart').focus();await page.keyboard.press('Home');assert.match(await page.locator('#tooltip').textContent(),/비트코인 자료 없음/);
 await page.locator('#alignment').selectOption('common');assert.match(await page.locator('#range').textContent(),/2014-10/);
 await page.locator('#alignment').selectOption('independent');await page.locator('[data-period="30"]').click();assert.match(await page.locator('#range').textContent(),/1996-08/);
 await page.locator('[data-period="all"]').click();
 await page.locator('#gold-period').selectOption('30');assert.match(await page.locator('#gold-range').textContent(),/1996/);await page.locator('#gold-period').selectOption('all');
 await page.locator('#mode').selectOption('return');assert.ok(await page.locator('#log').isDisabled());await page.locator('#mode').selectOption('index');await page.locator('#log').check();
 await page.locator('#ratio-period').selectOption('5');assert.match(await page.locator('#btc-gold-tip').textContent(),/2021/);await page.locator('#ratio-period').selectOption('all');
 await page.locator('#reserve-country').selectOption('KR');assert.equal(await page.locator('#reserves-trend polyline').count(),1);await page.locator('#reserve-log').check();
 await page.locator('#reserve-country').selectOption('all');
 await page.locator('#mining-region').selectOption('us');assert.equal(await page.locator('#mining-trend polyline').getAttribute('data-series'),'us');
 await page.locator('#country-search').fill('한국');assert.equal(await page.locator('#reserve-rows tr').count(),1);await page.locator('#country-search').fill('');
 await page.locator('[data-type="금광주형"]').click();assert.equal(await page.locator('.etf-card').count(),1);await page.locator('#etf-market').selectOption('한국');assert.match(await page.locator('#etf-cards').textContent(),/없습니다/);
 await page.locator('[data-type="전체"]').click();await page.locator('#etf-market').selectOption('전체');
 assert.equal(await page.locator('.methods-table tbody tr').count(),5);
 const download=page.waitForEvent('download');await page.locator('#download').click();const file=await download;
 assert.match(file.suggestedFilename(),/1960-01/);const csv=fs.readFileSync(await file.path(),'utf8');assert.match(csv.split('\r\n')[1],/"1960-01","35","0.9","",""/);
 await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
 for(const width of [390,768]){
  await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:8765/?theme=dark');await page.waitForSelector('#reserves-trend svg');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
 await page.goto('http://127.0.0.1:8765/?embed=overview&theme=light');await page.waitForSelector('#chart svg');assert.equal(await page.locator('.topbar').isVisible(),false);
 await page.route('**/api/gold',route=>route.fulfill({status:503,body:'Unavailable'}));await page.reload();await page.locator('#status button').waitFor();assert.match(await page.locator('#status').textContent(),/finance-pi/);
 await page.unroute('**/api/gold');await page.locator('#status button').click();await page.waitForSelector('#gold-long-chart svg');await page.locator('#research-status button').click();await page.waitForSelector('#reserves-trend svg');
 assert.deepEqual(errors,[]);await browser.close();console.log('Browser checks passed: finance-pi-only fetch, all historical charts, missing data, filters, CSV, mobile, embed, failure/retry.');
})().catch(e=>{console.error(e);process.exit(1)});
