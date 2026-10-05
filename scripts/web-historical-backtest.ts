import fs from "node:fs";
import path from "node:path";
import { calculate } from "../lib/model";
import { gradeBet } from "../lib/grading";

const FROM="2026-04-08", TO="2026-10-04";
const divisions:Record<string,string>={
 E0:"eng-premier-league",E1:"eng-championship",E2:"eng-league-one",E3:"eng-league-two",
 SP1:"esp-la-liga",SP2:"esp-segunda",I1:"ita-serie-a",I2:"ita-serie-b",
 D1:"ger-bundesliga",D2:"ger-2-bundesliga",F1:"fra-ligue-1",F2:"fra-ligue-2",
 N1:"ned-eredivisie",P1:"por-primeira-liga",B1:"bel-pro-league",SC0:"sco-premiership",
 T1:"tur-super-lig",G1:"gre-super-league"
};
const extras:{key:string;page:string;leagueId:string;seasonMode:"calendar"|"europe"}[]=[
 {key:"ARG",page:"argentina.php",leagueId:"arg-primera",seasonMode:"calendar"},
 {key:"AUT",page:"austria.php",leagueId:"aut-bundesliga",seasonMode:"europe"},
 {key:"BRA",page:"brazil.php",leagueId:"bra-serie-a",seasonMode:"calendar"},
 {key:"CHN",page:"china.php",leagueId:"chn-super-league",seasonMode:"calendar"},
 {key:"DEN",page:"denmark.php",leagueId:"den-superliga",seasonMode:"europe"},
 {key:"FIN",page:"finland.php",leagueId:"fin-veikkausliiga",seasonMode:"calendar"},
 {key:"JAP",page:"japan.php",leagueId:"jpn-j1",seasonMode:"calendar"},
 {key:"MEX",page:"mexico.php",leagueId:"mex-liga-mx",seasonMode:"calendar"},
 {key:"NOR",page:"norway.php",leagueId:"nor-eliteserien",seasonMode:"calendar"},
 {key:"POL",page:"poland.php",leagueId:"pol-ekstraklasa",seasonMode:"europe"},
 {key:"ROM",page:"romania.php",leagueId:"rou-liga-1",seasonMode:"europe"},
 {key:"SWE",page:"sweden.php",leagueId:"swe-allsvenskan",seasonMode:"calendar"},
 {key:"SUI",page:"switzerland.php",leagueId:"sui-super-league",seasonMode:"europe"},
 {key:"USA",page:"usa.php",leagueId:"usa-mls",seasonMode:"calendar"}
];
type Row={division:string;leagueId:string;date:string;home:string;away:string;hg:number;ag:number;source:string;season?:string};
type FbrefAdapter={key:string;leagueId:string;urls:string[];seasonMode:"calendar"|"europe"};
const fbrefAdapters:FbrefAdapter[]=[
 {key:"CZE",leagueId:"cze-first-league",seasonMode:"europe",urls:["https://fbref.com/en/comps/66/2025-2026/schedule/2025-2026-Czech-First-League-Scores-and-Fixtures","https://fbref.com/en/comps/66/2026-2027/schedule/2026-2027-Czech-First-League-Scores-and-Fixtures"]},
 {key:"CRO",leagueId:"cro-hnl",seasonMode:"europe",urls:["https://fbref.com/en/comps/63/2025-2026/schedule/2025-2026-Croatian-Football-League-Scores-and-Fixtures","https://fbref.com/en/comps/63/2026-2027/schedule/2026-2027-Croatian-Football-League-Scores-and-Fixtures"]},
 {key:"SER",leagueId:"ser-superliga",seasonMode:"europe",urls:["https://fbref.com/en/comps/54/2025-2026/schedule/2025-2026-Serbian-SuperLiga-Scores-and-Fixtures","https://fbref.com/en/comps/54/2026-2027/schedule/2026-2027-Serbian-SuperLiga-Scores-and-Fixtures"]},
 {key:"UKR",leagueId:"ukr-premier-league",seasonMode:"europe",urls:["https://fbref.com/en/comps/39/2025-2026/schedule/2025-2026-Ukrainian-Premier-League-Scores-and-Fixtures","https://fbref.com/en/comps/39/2026-2027/schedule/2026-2027-Ukrainian-Premier-League-Scores-and-Fixtures"]},
 {key:"BRB",leagueId:"bra-serie-b",seasonMode:"calendar",urls:["https://fbref.com/en/comps/38/2026/schedule/2026-Serie-B-Scores-and-Fixtures"]},
 {key:"COL",leagueId:"col-primera-a",seasonMode:"calendar",urls:["https://fbref.com/en/comps/41/schedule/Primera-A-Scores-and-Fixtures"]},
 {key:"J2",leagueId:"jpn-j2",seasonMode:"europe",urls:["https://fbref.com/en/comps/49/2025-2026/schedule/2025-2026-J2-League-Scores-and-Fixtures","https://fbref.com/en/comps/49/2026-2027/schedule/2026-2027-J2-League-Scores-and-Fixtures"]},
 {key:"KOR",leagueId:"kor-k1",seasonMode:"calendar",urls:["https://fbref.com/en/comps/55/2026/schedule/2026-K-League-1-Scores-and-Fixtures"]},
 {key:"AUS",leagueId:"aus-a-league",seasonMode:"europe",urls:["https://fbref.com/en/comps/65/2025-2026/schedule/2025-2026-A-League-Men-Scores-and-Fixtures"]},
 {key:"KSA",leagueId:"ksa-pro-league",seasonMode:"europe",urls:["https://fbref.com/en/comps/70/2025-2026/schedule/2025-2026-Saudi-Professional-League-Scores-and-Fixtures","https://fbref.com/en/comps/70/2026-2027/schedule/2026-2027-Saudi-Professional-League-Scores-and-Fixtures"]}
];
const split=(line:string)=>{const out:string[]=[];let cur="",q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===','&&!q){out.push(cur);cur=""}else cur+=ch}out.push(cur);return out};
async function fetchCsv(url:string){const r=await fetch(url,{headers:{"user-agent":"FIH-historical-backtest/1.0"}});if(!r.ok)throw new Error(url+" "+r.status);return r.text()}
const parseDate=(raw:string)=>{if(!raw)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;let m=raw.match(/^(\d{2})\/(\d{2})\/(\d{4}|\d{2})$/);if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${m[2]}-${m[1]}`}m=raw.match(/^(\d{2})-(\d{2})-(\d{4}|\d{2})$/);if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${m[2]}-${m[1]}`}return null};
async function load(){const rows:Row[]=[];for(const [division,leagueId] of Object.entries(divisions)){for(const season of ["2526","2627"]){const url=`https://www.football-data.co.uk/mmz4281/${season}/${division}.csv`;try{const txt=await fetchCsv(url);const lines=txt.split(/\r?\n/).filter(Boolean);const h=split(lines[0]);const ix=Object.fromEntries(h.map((x,i)=>[x,i]));for(const line of lines.slice(1)){const a=split(line),raw=a[ix.Date];if(!raw)continue;const m=raw.match(/^(\d{2})\/(\d{2})\/(\d{4}|\d{2})$/);if(!m)continue;let y=Number(m[3]);if(y<100)y+=2000;const date=`${y}-${m[2]}-${m[1]}`;const hg=Number(a[ix.FTHG]),ag=Number(a[ix.FTAG]);if(!Number.isFinite(hg)||!Number.isFinite(ag))continue;rows.push({division,leagueId,date,home:a[ix.HomeTeam],away:a[ix.AwayTeam],hg,ag,source:url})}}catch(e){console.warn("source unavailable",url,String(e))}}}
for(const x of extras){try{
 const pageUrl="https://www.football-data.co.uk/"+x.page;
 const html=await (await fetch(pageUrl,{headers:{"user-agent":"FIH-historical-backtest/1.0"}})).text();
 const hrefs=[...html.matchAll(/href=["']([^"']+\.csv(?:\?[^"']*)?)["']/gi)].map(m=>m[1]);
 const urls=[...new Set(hrefs.map(h=>new URL(h,pageUrl).href))];
 let loaded=0;
 for(const url of urls){try{
  const txt=await fetchCsv(url);const ls=txt.split(/\r?\n/).filter(Boolean);if(ls.length<2)continue;
  const h=split(ls[0]).map(v=>v.trim());const ix=Object.fromEntries(h.map((v,i)=>[v,i]));
  const dateCol=["Date","MatchDate"].find(k=>ix[k]!==undefined),homeCol=["Home","HomeTeam"].find(k=>ix[k]!==undefined),awayCol=["Away","AwayTeam"].find(k=>ix[k]!==undefined),hgCol=["HG","FTHG","HomeGoals"].find(k=>ix[k]!==undefined),agCol=["AG","FTAG","AwayGoals"].find(k=>ix[k]!==undefined);
  if(!dateCol||!homeCol||!awayCol||!hgCol||!agCol)continue;
  for(const line of ls.slice(1)){const a=split(line);const date=parseDate(a[ix[dateCol]]);const hg=Number(a[ix[hgCol]]),ag=Number(a[ix[agCol]]);if(!date||!Number.isFinite(hg)||!Number.isFinite(ag))continue;rows.push({division:x.key,leagueId:x.leagueId,date,home:a[ix[homeCol]],away:a[ix[awayCol]],hg,ag,source:url,season:ix.Season!==undefined?a[ix.Season]:undefined});loaded++}
 }catch(e){console.warn("extra csv unavailable",url,String(e))}
 }
 console.log("extra source",x.key,"urls",urls.length,"rows",loaded);
}catch(e){console.warn("extra page unavailable",x.page,String(e))}}
for(const ad of fbrefAdapters){let loaded=0;for(const url of ad.urls){try{let html=await (await fetch(url,{headers:{"user-agent":"Mozilla/5.0 FIHBacktest/1.0"}})).text();html=html.replace(/<!--/g,"").replace(/-->/g,"");for(const tr of html.matchAll(/<tr[^>]*>([\\s\\S]*?)<\\/tr>/gi)){const row=tr[1];const cell=(stat:string)=>{const m=row.match(new RegExp("<(?:th|td)[^>]*data-stat=[\\\"']"+stat+"[\\\"'][^>]*>([\\s\\S]*?)<\\/(?:th|td)>","i"));return m?m[1].replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&#x27;/g,"'").replace(/&nbsp;/g," ").replace(/\\s+/g," ").trim():""};const date=cell("date"),home=cell("home_team"),away=cell("away_team"),score=cell("score");const sm=score.match(/(\\d+)\\s*[–-]\\s*(\\d+)/);if(!date||!home||!away||!sm)continue;rows.push({division:ad.key,leagueId:ad.leagueId,date,home,away,hg:Number(sm[1]),ag:Number(sm[2]),source:url,season:ad.seasonMode==="calendar"?date.slice(0,4):undefined});loaded++}}catch(e){console.warn("fbref unavailable",url,String(e))}}console.log("fbref source",ad.key,"rows",loaded)}
const uniq=new Map<string,Row>();for(const r of rows){const k=[r.leagueId,r.date,r.home,r.away].join("|");if(!uniq.has(k))uniq.set(k,r)}return [...uniq.values()].sort((a,b)=>a.date.localeCompare(b.date))}
const seasonKey=(d:string,division?:string,explicit?:string)=>{if(explicit)return explicit;const ex=extras.find(x=>x.key===division);const fb=fbrefAdapters.find(x=>x.key===division);const y=+d.slice(0,4),m=+d.slice(5,7);if(ex?.seasonMode==="calendar"||fb?.seasonMode==="calendar")return String(y);return m>=7?`${y}-${y+1}`:`${y-1}-${y}`};
const avg=(a:{gf:number;ga:number}[],k:"gf"|"ga")=>a.reduce((s,x)=>s+x[k],0)/a.length;
function build(rows:Row[],idx:number){const f=rows[idx],prior=rows.slice(0,idx).filter(r=>r.division===f.division&&r.date<f.date),ss=prior.filter(r=>seasonKey(r.date)===seasonKey(f.date));if(!ss.length)return null;const leagueHomeGoals=ss.reduce((s,r)=>s+r.hg,0)/ss.length,leagueAwayGoals=ss.reduce((s,r)=>s+r.ag,0)/ss.length;if(!(leagueHomeGoals>0&&leagueAwayGoals>0))return null;let hp=prior.filter(r=>r.home===f.home).slice(-5).map(r=>({gf:r.hg,ga:r.ag})),ap=prior.filter(r=>r.away===f.away).slice(-5).map(r=>({gf:r.ag,ga:r.hg}));if(hp.length<3)hp=prior.filter(r=>r.home===f.home||r.away===f.home).slice(-5).map(r=>r.home===f.home?{gf:r.hg,ga:r.ag}:{gf:r.ag,ga:r.hg});if(ap.length<3)ap=prior.filter(r=>r.home===f.away||r.away===f.away).slice(-5).map(r=>r.home===f.away?{gf:r.hg,ga:r.ag}:{gf:r.ag,ga:r.hg});if(hp.length<3||ap.length<3)return null;const sampleSize=Math.min(hp.length,ap.length);return{homeAttack:avg(hp,"gf")/leagueHomeGoals,homeDefence:avg(hp,"ga")/leagueAwayGoals,awayAttack:avg(ap,"gf")/leagueAwayGoals,awayDefence:avg(ap,"ga")/leagueHomeGoals,leagueHomeGoals,leagueAwayGoals,sampleSize,modelLevel:"basic" as const,confidence:"low" as const,competitionType:"club" as const,dataQuality:"usable" as const}}
async function main(){
const rows=await load(),fixtures:any[]=[];let modelled=0,noModel=0,noBet=0;
for(let i=0;i<rows.length;i++){const f=rows[i];if(f.date<FROM||f.date>TO)continue;const input=build(rows,i);if(!input){noModel++;continue}modelled++;const m=calculate(input);if(!m.recommendedBet){noBet++;continue}fixtures.push({date:f.date,leagueId:f.leagueId,homeTeam:f.home,awayTeam:f.away,modelLevel:"basic",sampleSize:input.sampleSize,inputs:input,lambdaHome:m.lambdaHome,lambdaAway:m.lambdaAway,recommendedBet:m.recommendedBet,actualScore:{home:f.hg,away:f.ag},outcome:gradeBet(m.recommendedBet,{home:f.hg,away:f.ag}),sources:[f.source,"https://www.soccerbase.com/matches/results.sd?date="+f.date]})}
const wins=fixtures.filter(x=>x.outcome==="WIN").length,losses=fixtures.length-wins;
const group=(key:(x:any)=>string)=>Object.values(fixtures.reduce((a:any,x:any)=>{const k=key(x);a[k]??={key:k,bets:0,wins:0,losses:0};a[k].bets++;a[k][x.outcome==="WIN"?"wins":"losses"]++;return a},{})).map((x:any)=>({...x,hitRate:+(100*x.wins/x.bets).toFixed(1)}));
const report={status:"complete-supported-web-scope",modelVersion:"v2.4-calibrated-risk-selector",range:{start:FROM,end:TO},researchMethod:"web-reconstructed chronologically from Football-Data historical CSV; Soccerbase date pages retained as independent result/discovery verifier",sourceScope:{configuredLeagueCount:61,webModelledLeagueCount:new Set(rows.map(r=>r.leagueId)).size,webModelledLeagueIds:[...new Set(rows.map(r=>r.leagueId))],note:"This executable pass models every fixture available in the supported Football-Data configured leagues. Other configured leagues still require separate source adapters; they are not counted as tested predictions."},fixtures,aggregateMetrics:{webFixturesInRange:rows.filter(x=>x.date>=FROM&&x.date<=TO).length,modelledFixtures:modelled,noModel,noBet,recommendedBets:fixtures.length,wins,losses,hitRate:fixtures.length?+(100*wins/fixtures.length).toFixed(1):null,byPick:group(x=>x.recommendedBet.pick),byLeague:group(x=>x.leagueId),byRating:group(x=>x.recommendedBet.rating)},generatedAt:new Date().toISOString()};
const out=path.join(process.cwd(),`data/backtests/${FROM}_to_${TO}.json`);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report.aggregateMetrics,null,2));
}
main().catch(err=>{console.error(err);process.exit(1)});
