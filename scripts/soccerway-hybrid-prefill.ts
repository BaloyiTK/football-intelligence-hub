import fs from "node:fs";
import path from "node:path";

const SOCCERWAY="https://www.soccerway.com/";
const REQUIRED=["form","standings","headToHead","schedule"];
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const normalize=(s:string)=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(fc|cf|afc|sc|club|calcio|fk|ac|cd|ud|deportivo|bk)\b/g," ").replace(/[^a-z0-9]+/g," ").trim();
function similarity(a:string,b:string){
 const A=new Set(normalize(a).split(" ").filter(Boolean)),B=new Set(normalize(b).split(" ").filter(Boolean));
 if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return 2*hit/(A.size+B.size);
}
const strip=(s:string)=>s.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
const hrefRe=/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
function links(base:string,html:string){const out:any[]=[];let m;while((m=hrefRe.exec(html))){try{const url=new URL(m[1],base).toString(),label=strip(m[2]);if(label)out.push({url,label})}catch{}}return out}
function uniq<T>(xs:T[]){return [...new Set(xs)]}
function pairScore(home:string,away:string,label:string){
 const parts=String(label||"").split(/\s+(?:-|–|v|vs\.?|x)\s+/i).map(x=>x.trim()).filter(Boolean);
 if(parts.length>=2)return Math.max(similarity(home,parts[0])+similarity(away,parts[1]),similarity(home,parts[1])+similarity(away,parts[0]));
 return similarity(home,label)+similarity(away,label);
}
function dateIso(raw:string,referenceDate:string){
 const m=String(raw||"").match(/^(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4}))?/);
 if(!m)return String(raw||"");
 const day=Number(m[1]),month=Number(m[2]);let year=m[3]?Number(m[3]):Number(referenceDate.slice(0,4));
 if(year<100)year+=2000;
 if(!m[3]&&month>Number(referenceDate.slice(5,7))+4)year--;
 return [year,String(month).padStart(2,"0"),String(day).padStart(2,"0")].join("-");
}
function scoreToken(s:string){return /^\d{1,2}$/.test(s)?Number(s):null}
function parseEventChunk(lines:string[],team:string,referenceDate:string,sourceRef:string){
 if(!lines.length||!/^\d{1,2}\.\d{1,2}\./.test(lines[0]))return null;
 const resultIndex=lines.findIndex((x,i)=>i>0&&/^[WDL]$/.test(x));
 const end=resultIndex>0?resultIndex:lines.length;
 const body=lines.slice(1,end).filter(x=>x&&x!=="Pen"&&x!=="AET"&&x!=="ET");
 const nums=body.map((x,i)=>({i,n:scoreToken(x)})).filter(x=>x.n!==null);
 if(nums.length<2)return null;
 const firstScore=nums[0].i,secondScore=nums[1].i;
 const names=body.slice(0,firstScore).filter(x=>!/^(Standings|Draw|Round \d+|PL)$/i.test(x)&&!/^\(.+\)$/.test(x));
 if(names.length<2)return null;
 const home=names[names.length-2],away=names[names.length-1];
 const hs=similarity(team,home),as=similarity(team,away);if(Math.max(hs,as)<.55)return null;
 const hg=Number(body[firstScore]),ag=Number(body[secondScore]);
 return {date:dateIso(lines[0],referenceDate),opponent:hs>=as?away:home,venue:hs>=as?"HOME":"AWAY",goalsFor:hs>=as?hg:ag,goalsAgainst:hs>=as?ag:hg,sourceRef};
}
function parseLatestScores(text:string,team:string,referenceDate:string,sourceRef:string){
 const start=text.toLowerCase().indexOf("latest scores");if(start<0)return [];
 let section=text.slice(start+"latest scores".length);
 const cut=section.toLowerCase().indexOf("show more matches");if(cut>=0)section=section.slice(0,cut);
 const lines=section.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const starts:number[]=[];for(let i=0;i<lines.length;i++)if(/^\d{1,2}\.\d{1,2}\.(?:\d{2,4})?(?:\s+\d{1,2}:\d{2})?$/.test(lines[i]))starts.push(i);
 const out:any[]=[];for(let k=0;k<starts.length;k++){const r=parseEventChunk(lines.slice(starts[k],starts[k+1]??lines.length),team,referenceDate,sourceRef);if(r)out.push(r);}
 const seen=new Set<string>();return out.filter(r=>{const k=[r.date,r.opponent,r.venue,r.goalsFor,r.goalsAgainst].join("|");if(seen.has(k))return false;seen.add(k);return true;});
}
function parseStanding(text:string,team:string){
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 for(let i=0;i<lines.length;i++){
  if(similarity(team,lines[i])<.62)continue;
  const posLine=[lines[i-1],lines[i-2]].find(x=>/^\d+\.$/.test(String(x||"")));if(!posLine)continue;
  const next=lines.slice(i+1,i+8);if(next.length<7)continue;
  const nums=next.slice(0,4).map(Number);const gm=String(next[4]||"").match(/^(\d+):(\d+)$/),gd=Number(next[5]),pts=Number(next[6]);
  if(nums.some(n=>!Number.isFinite(n))||!gm||!Number.isFinite(gd)||!Number.isFinite(pts))continue;
  return {position:Number(posLine.replace(".","")),matches:nums[0],wins:nums[1],draws:nums[2],losses:nums[3],goalsFor:Number(gm[1]),goalsAgainst:Number(gm[2]),goalDifference:gd,points:pts};
 }
 return null;
}
function parseH2hAnchors(anchors:any[],home:string,away:string,referenceDate:string,sourceRef:string){
 const out:any[]=[],seen=new Set<string>();
 for(const a of anchors){
  if(!/\?mid=/.test(String(a.href||"")))continue;
  const lines=String(a.text||"").split(/\r?\n/).map((x:string)=>x.trim()).filter(Boolean);
  if(lines.length<6||!/^\d{1,2}\.\d{1,2}\./.test(lines[0]))continue;
  const scoreIdx=lines.map((x:string,i:number)=>({i,n:scoreToken(x)})).filter((x:any)=>x.n!==null);
  if(scoreIdx.length<2)continue;
  const first=scoreIdx[0].i,second=scoreIdx[1].i,names=lines.slice(1,first).filter((x:string)=>!/^([A-Z]{1,5}|Pen|AET|ET)$/.test(x));
  if(names.length<2)continue;const h=names[names.length-2],aw=names[names.length-1];
  if(Math.max(similarity(home,h)+similarity(away,aw),similarity(home,aw)+similarity(away,h))<1.1)continue;
  const row={date:dateIso(lines[0],referenceDate),homeTeam:h,awayTeam:aw,homeGoals:Number(lines[first]),awayGoals:Number(lines[second]),sourceRef};
  const key=[row.date,row.homeTeam,row.awayTeam,row.homeGoals,row.awayGoals].join("|");if(seen.has(key))continue;seen.add(key);out.push(row);if(out.length===5)break;
 }
 return out;
}
function fixtureMeta(date:string){
 const p=path.join(process.cwd(),"data/prediction-fixtures",date+".json");if(!fs.existsSync(p))return new Map<string,any>();
 const b=JSON.parse(fs.readFileSync(p,"utf8")),out=new Map<string,any>();
 for(const s of b.payload?.Stages||[])for(const e of s.Events||[])out.set(String(e.Eid??e.Id),{country:String(s.Cnm||s.Csnm||""),countrySlug:String(s.Ccd||""),competition:String(s.CompN||s.Snm||""),competitionSlug:String(s.CompUrlName||s.Scd||"")});
 return out;
}

export async function applySoccerwayFallback(args:{date:string;fixtures:any[];results:any[]}){
 const {date,fixtures,results}=args,needs=results.filter((r:any)=>!r.matched||REQUIRED.some(k=>!r.categories?.[k]?.complete));
 if(!needs.length)return {attempted:0,matched:0,categoryComplete:{form:0,standings:0,headToHead:0,schedule:0},pageLoads:0,errors:[]};
 let chromium:any;try{({chromium}=await import("playwright"));}catch(e:any){return {attempted:needs.length,matched:0,categoryComplete:{form:0,standings:0,headToHead:0,schedule:0},pageLoads:0,errors:["PLAYWRIGHT_UNAVAILABLE:"+String(e?.message||e)]};}
 const meta=fixtureMeta(date),staticCache=new Map<string,Promise<any>>(),renderCache=new Map<string,Promise<any>>();
 let lastStart=0,pageLoads=0;const globalErrors:string[]=[];
 async function pace(){const d=6100-(Date.now()-lastStart);if(d>0)await sleep(d);lastStart=Date.now();}
 async function staticPage(url:string){if(!staticCache.has(url))staticCache.set(url,(async()=>{await pace();const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);try{const r=await fetch(url,{signal:c.signal,redirect:"follow",headers:{"user-agent":"Mozilla/5.0 (compatible; FootballIntelligenceHub/0.1)","accept":"text/html"}});if(!r.ok)throw new Error("SOCCERWAY_HTTP_"+r.status);const html=await r.text();return {url:r.url,html,links:links(r.url,html),retrievedAt:new Date().toISOString()};}finally{clearTimeout(timer)}})());return staticCache.get(url)!;}
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({userAgent:"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36"});
 await context.route("**/*",(route:any)=>{const t=route.request().resourceType();if(["image","font","media"].includes(t))return route.abort();return route.continue();});
 const page=await context.newPage();
 async function rendered(url:string,ready:string[]){if(!renderCache.has(url))renderCache.set(url,(async()=>{await pace();pageLoads++;await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000});try{await page.waitForFunction((needles:any[])=>{const t=(document.body?.innerText||"").toLowerCase();return needles.some(x=>t.includes(String(x).toLowerCase()));},ready,{timeout:9000});}catch{}const text=await page.locator("body").innerText().catch(()=> "");const anchors=await page.locator("a").evaluateAll((els:any[])=>els.map((a:any)=>({text:(a.innerText||"").trim(),href:a.href||""}))).catch(()=>[]);return {url,text,anchors,retrievedAt:new Date().toISOString()};})());return renderCache.get(url)!;}
 let world:any;try{world=await staticPage(SOCCERWAY+"world/");}catch(e:any){await browser.close();return {attempted:needs.length,matched:0,categoryComplete:{form:0,standings:0,headToHead:0,schedule:0},pageLoads,errors:["SOCCERWAY_WORLD_FAILED:"+String(e?.message||e)]};}
 const before=Object.fromEntries(REQUIRED.map(k=>[k,results.filter((r:any)=>r.categories?.[k]?.complete).length]));
 let matchedAdded=0;
 for(const r of needs){
  const f=fixtures.find((x:any)=>String(x.fixtureId)===String(r.fixtureId))||r.fixture,m=meta.get(String(r.fixtureId))||{},errors=r.errors||(r.errors=[]);
  try{
   const countryCandidates=world.links.map((x:any)=>({...x,score:similarity(m.country,x.label)})).filter((x:any)=>x.score>=.72&&new URL(x.url).hostname.endsWith("soccerway.com")).sort((a:any,b:any)=>b.score-a.score);
   const country=countryCandidates[0];if(!country){errors.push("SOCCERWAY_COUNTRY_NOT_FOUND");continue}
   const cp=await staticPage(country.url),countryPath=new URL(country.url).pathname;
   const comps=cp.links.map((x:any)=>({...x,score:Math.max(similarity(f.competition,x.label),similarity(m.competition,x.label))+(m.competitionSlug&&new URL(x.url).pathname.includes(String(m.competitionSlug).replace(/^sg-/,""))?.15:0)}))
    .filter((x:any)=>x.score>=.6&&new URL(x.url).hostname.endsWith("soccerway.com")&&new URL(x.url).pathname.startsWith(countryPath)&&new URL(x.url).pathname!==countryPath)
    .sort((a:any,b:any)=>b.score-a.score);
   const competition=comps[0];if(!competition){errors.push("SOCCERWAY_COMPETITION_NOT_FOUND");continue}
   const lp=await staticPage(competition.url);
   const matches=lp.links.filter((x:any)=>/\/match\//.test(new URL(x.url).pathname)).map((x:any)=>({...x,score:pairScore(f.home,f.away,x.label)})).sort((a:any,b:any)=>b.score-a.score);
   const match=matches[0];if(!match||match.score<1.0){errors.push("SOCCERWAY_FIXTURE_NOT_FOUND");continue}
   if(!r.matched){r.matched=true;matchedAdded++;}
   const mp=await rendered(match.url,["HEAD-TO-HEAD MATCHES","STANDINGS","H2H"]);
   r.sourceMetadata=[...(r.sourceMetadata||[]),{url:match.url,retrievedAt:mp.retrievedAt,supports:["fixtureMatch","headToHead","standings"]}];
   if(!r.categories)r.categories={};
   if(!r.categories.standings?.complete){
    const homeStanding=parseStanding(mp.text,f.home),awayStanding=parseStanding(mp.text,f.away);
    if(homeStanding&&awayStanding)r.categories.standings={complete:true,homeTeam:homeStanding,awayTeam:awayStanding};
   }
   if(!r.categories.headToHead?.complete){
    let h2h=parseH2hAnchors(mp.anchors,f.home,f.away,date,match.url);
    if(h2h.length<5){
     try{const more=page.getByText("Show more matches",{exact:true}).first();if(await more.count()){await more.click();await page.waitForTimeout(1200);const anchors=await page.locator("a").evaluateAll((els:any[])=>els.map((a:any)=>({text:(a.innerText||"").trim(),href:a.href||""})));h2h=parseH2hAnchors(anchors,f.home,f.away,date,match.url);}}catch{}
    }
    if(h2h.length===5)r.categories.headToHead={complete:true,matches:h2h};
   }
   if(!r.categories.form?.complete||!r.categories.schedule?.complete){
    const teamLinks=mp.anchors.filter((x:any)=>/\/team\//.test(String(x.href||""))).map((x:any)=>({...x,homeScore:similarity(f.home,x.text),awayScore:similarity(f.away,x.text)}));
    const homeLink=teamLinks.sort((a:any,b:any)=>b.homeScore-a.homeScore)[0],awayLink=teamLinks.sort((a:any,b:any)=>b.awayScore-a.awayScore)[0];
    if(homeLink?.homeScore>=.55&&awayLink?.awayScore>=.55){
     const hp=await rendered(homeLink.href,["Latest Scores"]),ap=await rendered(awayLink.href,["Latest Scores"]);
     let homeRows=parseLatestScores(hp.text,f.home,date,homeLink.href),awayRows=parseLatestScores(ap.text,f.away,date,awayLink.href);
     if(homeRows.filter((x:any)=>x.venue==="HOME").length<5||awayRows.filter((x:any)=>x.venue==="AWAY").length<5){
      for(const [url,target] of [[homeLink.href,f.home],[awayLink.href,f.away]] as any){
       try{await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000});const more=page.getByText("Show more matches",{exact:true}).first();if(await more.count()){await more.click();await page.waitForTimeout(1200);const t=await page.locator("body").innerText();if(url===homeLink.href)homeRows=parseLatestScores(t,target,date,url);else awayRows=parseLatestScores(t,target,date,url);}}catch{}
      }
     }
     const homeOverall=homeRows.slice(0,5),homeVenue=homeRows.filter((x:any)=>x.venue==="HOME").slice(0,5),awayOverall=awayRows.slice(0,5),awayVenue=awayRows.filter((x:any)=>x.venue==="AWAY").slice(0,5);
     const formOk=homeOverall.length===5&&homeVenue.length===5&&awayOverall.length===5&&awayVenue.length===5;
     if(formOk)r.categories.form={complete:true,homeOverall,homeVenue,awayOverall,awayVenue};
     if(homeOverall[0]?.date&&awayOverall[0]?.date)r.categories.schedule={complete:true,homeTeam:{latestCompletedMatchDate:homeOverall[0].date},awayTeam:{latestCompletedMatchDate:awayOverall[0].date}};
     r.sourceMetadata.push({url:homeLink.href,retrievedAt:hp.retrievedAt,supports:["form","schedule"]},{url:awayLink.href,retrievedAt:ap.retrievedAt,supports:["form","schedule"]});
    }else errors.push("SOCCERWAY_TEAM_LINK_NOT_FOUND");
   }
   r.gaps=REQUIRED.filter(k=>!r.categories?.[k]?.complete);
  }catch(e:any){errors.push("SOCCERWAY_FALLBACK:"+String(e?.message||e));globalErrors.push(String(e?.message||e));}
 }
 await page.close();await context.close();await browser.close();
 const after=Object.fromEntries(REQUIRED.map(k=>[k,results.filter((r:any)=>r.categories?.[k]?.complete).length]));
 return {attempted:needs.length,matched:matchedAdded,categoryComplete:Object.fromEntries(REQUIRED.map(k=>[k,Number(after[k])-Number(before[k])])),pageLoads,cacheEntries:{static:staticCache.size,rendered:renderCache.size},errors:uniq(globalErrors).slice(0,20)};
}
