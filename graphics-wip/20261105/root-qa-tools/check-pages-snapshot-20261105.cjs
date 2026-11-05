const base=process.env.OLDGOLD_QA_URL||"https://xxxlexolasxxx.github.io/OldGold/";
const{chromium}=require('./browsers/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
for(const[name,width,height]of[['desktop',1440,1000],['mobile',390,844]]){
const p=await b.newPage({viewport:{width,height},serviceWorkers:'block'}),errors=[],missing=[];
p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/OldGold/assets/fantasy/')&&r.status()!==200)missing.push(r.url());});
await p.route('**/*',r=>r.request().url().startsWith(base)||r.request().url().startsWith('data:')?r.continue():r.abort());
await p.goto(base,{waitUntil:'domcontentloaded'});
await p.locator('[data-sm="new"]').waitFor({timeout:120000});
await p.evaluate(()=>teleSetOn(false));await p.locator('#tele-ask [data-a="no"]').click({timeout:1000}).catch(()=>{});
await p.evaluate(async()=>{await FantasyPublishedArt.ready;await FantasyPublishedHaunts.ready;if(window.FantasyDarkCourtPolish)await FantasyDarkCourtPolish.ready;});
const coverage=await p.evaluate(()=>({portraits:FantasyPublishedPortraits.roles.length,ground:!!window.FantasyPublishedGround,decor:!!window.FantasyPublishedDecor,assets:Object.keys(FantasyPublishedArt.images).length,native:Object.keys(BUILDINGS).filter(t=>!buildingSprite(t,0,1)._publishedArt)}));
console.log(JSON.stringify({name,coverage}));if(coverage.portraits!==16||coverage.assets!==44||coverage.native.length)throw Error('Incomplete deployed graphics coverage');
for(const sel of ['[data-sm="new"]','[data-sm="mode-free"]','[data-sm="map-go"]','[data-sm="diff:normal"]']){
await p.waitForFunction(()=>!StartMenu.busy,null,{polling:100,timeout:120000});await p.locator(sel).click({timeout:60000});}
await p.waitForSelector('#ha-editor',{timeout:120000});await p.locator('#ha-name').fill('Баганет');
await p.locator('.ha-sw[data-i="1"][data-v="2"]').click();await p.screenshot({path:`output/fantasy/audit-baganet/snapshot-20261105-${name}-editor.png`});
await p.locator('[data-ha="ok"]').click();await p.waitForTimeout(1500);await p.screenshot({path:`output/fantasy/audit-baganet/snapshot-20261105-${name}-game.png`});
const result=await p.evaluate(()=>({version:GAME_VERSION,hero:!!Game.hero,name:Game.hero?.hero?.name,buildings:Game.buildings.length,art:FantasyPublishedArt.errors,trees:typeof FantasyTreesPolish,editorClosed:!document.getElementById('ha-editor')}));
console.log(JSON.stringify({name,result,errors,missing}));if(result.version!=='0.11.99'||!result.hero||errors.length||missing.length||result.art.length)process.exitCode=1;await p.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
