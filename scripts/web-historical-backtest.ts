import fs from "node:fs";
import path from "node:path";
import { calculate, type ModelInput } from "../lib/model";
import { gradeBet } from "../lib/grading";

const FROM="2026-04-08", TO="2026-10-04";
type CompetitionType="club"|"international"|"friendly";
type Row={division:string;leagueId:string;date:string;home:string;away:string;hg:number;ag:number;source:string;season?:string;seasonMode:"calendar"|"europe";competitionType:CompetitionType;international?:boolean};

const primary:Record<string,string>={
 E0:"eng-premier-league",E1:"eng-championship",E2:"eng-league-one",E3:"eng-league-two",
 SP1:"esp-la-liga",SP2:"esp-segunda",I1:"ita-serie-a",I2:"ita-serie-b",
 D1:"ger-bundesliga",D2:"ger-2-bundesliga",F1:"fra-ligue-1",F2:"fra-ligue-2",
 N1:"ned-eredivisie",P1:"por-primeira-liga",B1:"bel-pro-league",SC0:"sco-premiership",
 T1:"tur-super-lig",G1:"gre-super-league"
};
const extraPages:{key:string;page:string;leagueId:string;seasonMode:"calendar"|"europe"}[]=[
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
const mirror:{key:string;leagueId:string;seasonMode:"calendar"|"europe";competitionType:CompetitionType;files:string[]}[]=[
 {key:"CZE",leagueId:"cze-first-league",seasonMode:"europe",competitionType:"club",files:["Czech First League Full Match List 25-26.csv","Czech First League Full Match List 26-27.csv"]},
 {key:"CRO",leagueId:"cro-hnl",seasonMode:"europe",competitionType:"club",files:["1. HNL Full Match List 25-26.csv","1. HNL Full Match List 26-27.csv"]},
 {key:"SER",leagueId:"ser-superliga",seasonMode:"europe",competitionType:"club",files:["Serbian Super Liga Full Match List 25-26.csv","Serbian Super Liga Full Match List 26-27.csv"]},
 {key:"BRB",leagueId:"bra-serie-b",seasonMode:"calendar",competitionType:"club",files:["Brazil Serie B Full Match List 2026.csv"]},
 {key:"COL",leagueId:"col-primera-a",seasonMode:"calendar",competitionType:"club",files:["Colombian Primera A Full Match List 2026.csv"]},
 {key:"KOR",leagueId:"kor-k1",seasonMode:"calendar",competitionType:"club",files:["K League 1 Full Match List 2026.csv"]},
 {key:"KSA",leagueId:"ksa-pro-league",seasonMode:"europe",competitionType:"club",files:["Saudi Pro League Full Match List 25-26.csv","Saudi Pro League Full Match List 26-27.csv"]},
 {key:"QAT",leagueId:"qat-stars-league",seasonMode:"europe",competitionType:"club",files:["Qatari Stars League Full Match List 25-26.csv","Qatari Stars League Full Match List 26-27.csv"]},
 {key:"UAE",leagueId:"uae-pro-league",seasonMode:"europe",competitionType:"club",files:["UAE Pro League Full Match List 25-26.csv","UAE Pro League Full Match List 26-27.csv"]},
 {key:"RSA",leagueId:"rsa-premiership",seasonMode:"europe",competitionType:"club",files:["South Africa PSL Full Match List 25-26.csv","South Africa PSL Full Match List 26-27.csv"]},
 {key:"EGY",leagueId:"egy-premier-league",seasonMode:"europe",competitionType:"club",files:["Egyptian Premier League Full Match List 25-26.csv","Egyptian Premier League Full Match List 26-27.csv"]},
 {key:"J2",leagueId:"jpn-j2",seasonMode:"calendar",competitionType:"club",files:["J2-J3 Full Match List 100 Year Vision League.csv"]},
 {key:"WC",leagueId:"fifa-world-cup",seasonMode:"calendar",competitionType:"international",files:["World Cup Full Match List 2026.csv"]}
];
const hector:{key:string;leagueId:string;file:string;seasonMode:"calendar"|"europe";competitionType:CompetitionType}[]=[
 {key:"UCL",leagueId:"uefa-champions-league",file:"historico_champions.csv",seasonMode:"europe",competitionType:"club"},
 {key:"UEL",leagueId:"uefa-europa-league",file:"historico_europa_league.csv",seasonMode:"europe",competitionType:"club"},
 {key:"UECL",leagueId:"uefa-conference-league",file:"historico_conference_league.csv",seasonMode:"europe",competitionType:"club"},
 {key:"LIB",leagueId:"conmebol-libertadores",file:"historico_libertadores.csv",seasonMode:"calendar",competitionType:"club"},
 {key:"SUD",leagueId:"conmebol-sudamericana",file:"historico_sudamericana.csv",seasonMode:"calendar",competitionType:"club"},
 {key:"RSA",leagueId:"rsa-premiership",file:"historico_rsa_premier.csv",seasonMode:"europe",competitionType:"club"}
];
const fbref:{key:string;leagueId:string;seasonMode:"calendar"|"europe";competitionType:CompetitionType;urls:string[]}[]=[
 {key:"CZE",leagueId:"cze-first-league",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/66/2025-2026/schedule/2025-2026-Czech-First-League-Scores-and-Fixtures","https://fbref.com/en/comps/66/2026-2027/schedule/2026-2027-Czech-First-League-Scores-and-Fixtures"]},
 {key:"CRO",leagueId:"cro-hnl",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/63/2025-2026/schedule/2025-2026-Croatian-Football-League-Scores-and-Fixtures","https://fbref.com/en/comps/63/2026-2027/schedule/2026-2027-Croatian-Football-League-Scores-and-Fixtures"]},
 {key:"SER",leagueId:"ser-superliga",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/54/2025-2026/schedule/2025-2026-Serbian-SuperLiga-Scores-and-Fixtures","https://fbref.com/en/comps/54/2026-2027/schedule/2026-2027-Serbian-SuperLiga-Scores-and-Fixtures"]},
 {key:"UKR",leagueId:"ukr-premier-league",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/39/2025-2026/schedule/2025-2026-Ukrainian-Premier-League-Scores-and-Fixtures","https://fbref.com/en/comps/39/2026-2027/schedule/2026-2027-Ukrainian-Premier-League-Scores-and-Fixtures"]},
 {key:"BRB",leagueId:"bra-serie-b",seasonMode:"calendar",competitionType:"club",urls:["https://fbref.com/en/comps/38/2026/schedule/2026-Serie-B-Scores-and-Fixtures"]},
 {key:"COL",leagueId:"col-primera-a",seasonMode:"calendar",competitionType:"club",urls:["https://fbref.com/en/comps/41/schedule/Primera-A-Scores-and-Fixtures"]},
 {key:"J2",leagueId:"jpn-j2",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/49/2025-2026/schedule/2025-2026-J2-League-Scores-and-Fixtures","https://fbref.com/en/comps/49/2026-2027/schedule/2026-2027-J2-League-Scores-and-Fixtures"]},
 {key:"KOR",leagueId:"kor-k1",seasonMode:"calendar",competitionType:"club",urls:["https://fbref.com/en/comps/55/2026/schedule/2026-K-League-1-Scores-and-Fixtures"]},
 {key:"AUS",leagueId:"aus-a-league",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/65/2025-2026/schedule/2025-2026-A-League-Men-Scores-and-Fixtures"]},
 {key:"KSA",leagueId:"ksa-pro-league",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/70/2025-2026/schedule/2025-2026-Saudi-Professional-League-Scores-and-Fixtures","https://fbref.com/en/comps/70/2026-2027/schedule/2026-2027-Saudi-Professional-League-Scores-and-Fixtures"]},
 {key:"RSA",leagueId:"rsa-premiership",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/52/2025-2026/schedule/2025-2026-South-African-Premiership-Scores-and-Fixtures","https://fbref.com/en/comps/52/2026-2027/schedule/2026-2027-South-African-Premiership-Scores-and-Fixtures"]},
 {key:"UCL",leagueId:"uefa-champions-league",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/8/2025-2026/schedule/2025-2026-Champions-League-Scores-and-Fixtures","https://fbref.com/en/comps/8/2026-2027/schedule/2026-2027-Champions-League-Scores-and-Fixtures"]},
 {key:"UEL",leagueId:"uefa-europa-league",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/19/2025-2026/schedule/2025-2026-Europa-League-Scores-and-Fixtures","https://fbref.com/en/comps/19/2026-2027/schedule/2026-2027-Europa-League-Scores-and-Fixtures"]},
 {key:"UECL",leagueId:"uefa-conference-league",seasonMode:"europe",competitionType:"club",urls:["https://fbref.com/en/comps/882/2025-2026/schedule/2025-2026-Conference-League-Scores-and-Fixtures","https://fbref.com/en/comps/882/2026-2027/schedule/2026-2027-Conference-League-Scores-and-Fixtures"]},
 {key:"LIB",leagueId:"conmebol-libertadores",seasonMode:"calendar",competitionType:"club",urls:["https://fbref.com/en/comps/14/schedule/Copa-Libertadores-Scores-and-Fixtures"]},
 {key:"SUD",leagueId:"conmebol-sudamericana",seasonMode:"calendar",competitionType:"club",urls:["https://fbref.com/en/comps/205/schedule/Copa-Sudamericana-Scores-and-Fixtures"]},
 {key:"NATIONS",leagueId:"uefa-nations-league",seasonMode:"europe",competitionType:"international",urls:["https://fbref.com/en/comps/677/2026-2027/schedule/2026-2027-UEFA-Nations-League-Scores-and-Fixtures"]},
 {key:"WC",leagueId:"fifa-world-cup",seasonMode:"calendar",competitionType:"international",urls:["https://fbref.com/en/comps/1/schedule/World-Cup-Scores-and-Fixtures"]},
 {key:"FRIEND",leagueId:"international-friendlies",seasonMode:"calendar",competitionType:"friendly",urls:["https://fbref.com/en/comps/218/2026/schedule/2026-Friendlies-M-Scores-and-Fixtures"]}
];

const splitCsv=(line:string)=>{const out:string[]=[];let cur="",q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===","&&!q){out.push(cur);cur=""}else cur+=ch}out.push(cur);return out};
const parseDate=(raw:string)=>{if(!raw)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;const m=raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4}|\d{2})$/);if(!m)return null;let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${m[2]}-${m[1]}`};
const decode=(s:string)=>s.replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&#x27;|&#39;/g,"'").replace(/&nbsp;/g," ").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
const seasonKey=(r:Row)=>{if(r.season)return r.season;const y=+r.date.slice(0,4),m=+r.date.slice(5,7);return r.seasonMode==="calendar"?String(y):(m>=7?`${y}-${y+1}`:`${y-1}-${y}`)};
async function get(url:string){const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 FIHHistoricalBacktest/1.0"}});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.text()}

function addCsv(txt:string,meta:{division:string;leagueId:string;source:string;seasonMode:"calendar"|"europe"}):Row[]{
 const ls=txt.split(/\r?\n/).filter(Boolean);if(ls.length<2)return[];const h=splitCsv(ls[0]).map(x=>x.trim()),ix=Object.fromEntries(h.map((x,i)=>[x,i]));
 const dc=["Date","MatchDate"].find(k=>ix[k]!=null),hc=["HomeTeam","Home"].find(k=>ix[k]!=null),ac=["AwayTeam","Away"].find(k=>ix[k]!=null),hgc=["FTHG","HG","HomeGoals"].find(k=>ix[k]!=null),agc=["FTAG","AG","AwayGoals"].find(k=>ix[k]!=null);
 if(!dc||!hc||!ac||!hgc||!agc)return[];
 const out:Row[]=[];for(const line of ls.slice(1)){const a=splitCsv(line),date=parseDate(a[ix[dc]]),hg=Number(a[ix[hgc]]),ag=Number(a[ix[agc]]);if(!date||!a[ix[hc]]||!a[ix[ac]]||!Number.isFinite(hg)||!Number.isFinite(ag))continue;out.push({division:meta.division,leagueId:meta.leagueId,date,home:a[ix[hc]],away:a[ix[ac]],hg,ag,source:meta.source,season:ix.Season!=null?a[ix.Season]:undefined,seasonMode:meta.seasonMode,competitionType:"club"})}return out
}
function addFbref(html:string,ad:typeof fbref[number],source:string):Row[]{
 html=html.replace(/<!--/g,"").replace(/-->/g,"");const out:Row[]=[];
 for(const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){const tr=m[1];const cell=(stat:string)=>{const rx=new RegExp(`<(?:th|td)[^>]*data-stat=["']${stat}["'][^>]*>([\\s\\S]*?)<\\/(?:th|td)>`,"i");const z=tr.match(rx);return z?decode(z[1]):""};const date=cell("date"),home=cell("home_team"),away=cell("away_team"),score=cell("score");const sm=score.match(/(\d+)\s*[–-]\s*(\d+)/);if(!date||!home||!away||!sm)continue;out.push({division:ad.key,leagueId:ad.leagueId,date,home,away,hg:Number(sm[1]),ag:Number(sm[2]),source,seasonMode:ad.seasonMode,competitionType:ad.competitionType,international:ad.competitionType!=="club"})}
 return out
}
async function loadRows(){
 const rows:Row[]=[];
 for(const [division,leagueId] of Object.entries(primary))for(const season of ["2526","2627"]){const url=`https://www.football-data.co.uk/mmz4281/${season}/${division}.csv`;try{rows.push(...addCsv(await get(url),{division,leagueId,source:url,seasonMode:"europe"}))}catch(e){console.warn("primary",String(e))}}
 for(const x of extraPages){try{const pageUrl="https://www.football-data.co.uk/"+x.page,html=await get(pageUrl),hrefs=[...html.matchAll(/href=["']([^"']+\.csv(?:\?[^"']*)?)["']/gi)].map(m=>m[1]);for(const href of [...new Set(hrefs)]){const url=new URL(href,pageUrl).href;try{rows.push(...addCsv(await get(url),{division:x.key,leagueId:x.leagueId,source:url,seasonMode:x.seasonMode}))}catch(e){console.warn("extra csv",String(e))}}}catch(e){console.warn("extra page",x.page,String(e))}}
 for(const ad of hector){const url="https://raw.githubusercontent.com/HectorMontiel/mundial-2026-predictor/main/"+ad.file;try{const txt=await get(url),ls=txt.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);if(ls.length<2)continue;const h=splitCsv(ls[0]),ix=Object.fromEntries(h.map((x,i)=>[x.trim(),i]));for(const line of ls.slice(1)){const a=splitCsv(line),date=parseDate((a[ix.date]??"").slice(0,10)),home=a[ix.home_team],away=a[ix.away_team],hg=Number(a[ix.home_goals]),ag=Number(a[ix.away_goals]);if(!date||!home||!away||!Number.isFinite(hg)||!Number.isFinite(ag))continue;rows.push({division:ad.key,leagueId:ad.leagueId,date,home,away,hg,ag,source:url,seasonMode:ad.seasonMode,competitionType:ad.competitionType})}}catch(e){console.warn("hector",ad.key,String(e))}}
 try{const url="https://raw.githubusercontent.com/HectorMontiel/mundial-2026-predictor/main/historico_selecciones.csv",txt=await get(url),ls=txt.replace(/^\uFEFF/,"").split(/\\r?\\n/).filter(Boolean),h=splitCsv(ls[0]),ix=Object.fromEntries(h.map((x,i)=>[x.trim(),i]));for(const line of ls.slice(1)){const a=splitCsv(line),date=parseDate((a[ix.date]??"").slice(0,10)),home=a[ix.home_team],away=a[ix.away_team],hg=Number(a[ix.home_goals]),ag=Number(a[ix.away_goals]),t=String(a[ix.tournament]??"").toLowerCase();if(!date||!home||!away||!Number.isFinite(hg)||!Number.isFinite(ag))continue;let leagueId:string|null=null,key="",competitionType:CompetitionType="international";if(t.includes("nations")){leagueId="uefa-nations-league";key="NATIONS"}else if(t.includes("amist")||t.includes("friend")){leagueId="international-friendlies";key="FRIEND";competitionType="friendly"}else if(t.includes("world cup")||t.includes("copa mundial")){leagueId="fifa-world-cup";key="WC"}if(!leagueId)continue;rows.push({division:key,leagueId,date,home,away,hg,ag,source:url,seasonMode:"calendar",competitionType,international:true})}}catch(e){console.warn("hector selections",String(e))}
 for(const ad of mirror)for(const file of ad.files){const url="https://raw.githubusercontent.com/griffisben/Post_Match_App/main/League_Files/"+encodeURIComponent(file).replace(/%2F/g,"/");try{const txt=await get(url),ls=txt.replace(/^\uFEFF/,"").split(/\\r?\\n/).filter(Boolean);if(ls.length<2)continue;const h=splitCsv(ls[0]),ix=Object.fromEntries(h.map((x,i)=>[x.trim(),i]));for(const line of ls.slice(1)){const a=splitCsv(line),date=parseDate(a[ix.Date]),home=a[ix.Home],away=a[ix.Away],match=a[ix.Match]??"";const sm=match.match(/(\d+)\s*[-–]\s*(\d+)/);if(!date||!home||!away||!sm)continue;rows.push({division:ad.key,leagueId:ad.leagueId,date,home,away,hg:Number(sm[1]),ag:Number(sm[2]),source:url,seasonMode:ad.seasonMode,competitionType:ad.competitionType,international:ad.competitionType!=="club"})}}catch(e){console.warn("mirror",ad.key,String(e))}}
 for(const ad of fbref)for(const url of ad.urls){try{rows.push(...addFbref(await get(url),ad,url))}catch(e){console.warn("fbref",ad.key,String(e))}}
 const uniq=new Map<string,Row>();for(const r of rows){const k=[r.leagueId,r.date,r.home,r.away].join("|");if(!uniq.has(k))uniq.set(k,r)}return [...uniq.values()].sort((a,b)=>a.date.localeCompare(b.date))
}
const avg=(a:{gf:number;ga:number}[],k:"gf"|"ga")=>a.reduce((s,x)=>s+x[k],0)/a.length;
function buildInput(rows:Row[],i:number):ModelInput|null{
 const f=rows[i],allPrior=rows.slice(0,i).filter(r=>r.date<f.date);
 const compPrior=allPrior.filter(r=>r.division===f.division),baseline=compPrior.filter(r=>seasonKey(r)===seasonKey(f));if(!baseline.length)return null;
 const leagueHomeGoals=baseline.reduce((s,r)=>s+r.hg,0)/baseline.length,leagueAwayGoals=baseline.reduce((s,r)=>s+r.ag,0)/baseline.length;if(!(leagueHomeGoals>0&&leagueAwayGoals>0))return null;
 const teamPrior=f.international?allPrior.filter(r=>r.international):compPrior;
 let hp=teamPrior.filter(r=>r.home===f.home).slice(-5).map(r=>({gf:r.hg,ga:r.ag})),ap=teamPrior.filter(r=>r.away===f.away).slice(-5).map(r=>({gf:r.ag,ga:r.hg}));
 if(hp.length<3)hp=teamPrior.filter(r=>r.home===f.home||r.away===f.home).slice(-5).map(r=>r.home===f.home?{gf:r.hg,ga:r.ag}:{gf:r.ag,ga:r.hg});
 if(ap.length<3)ap=teamPrior.filter(r=>r.home===f.away||r.away===f.away).slice(-5).map(r=>r.home===f.away?{gf:r.hg,ga:r.ag}:{gf:r.ag,ga:r.hg});
 if(hp.length<3||ap.length<3)return null;const sampleSize=Math.min(hp.length,ap.length);
 return{homeAttack:avg(hp,"gf")/leagueHomeGoals,homeDefence:avg(hp,"ga")/leagueAwayGoals,awayAttack:avg(ap,"gf")/leagueAwayGoals,awayDefence:avg(ap,"ga")/leagueHomeGoals,leagueHomeGoals,leagueAwayGoals,sampleSize,modelLevel:"basic",confidence:"low",competitionType:f.competitionType,dataQuality:"usable"}
}
async function main(){
 const rows=await loadRows(),fixtures:any[]=[];let modelled=0,noModel=0,noBet=0;
 for(let i=0;i<rows.length;i++){const f=rows[i];if(f.date<FROM||f.date>TO)continue;const inputs=buildInput(rows,i);if(!inputs){noModel++;continue}modelled++;const m=calculate(inputs);if(!m.recommendedBet){noBet++;continue}fixtures.push({date:f.date,leagueId:f.leagueId,homeTeam:f.home,awayTeam:f.away,modelLevel:"basic",sampleSize:inputs.sampleSize,inputs,lambdaHome:m.lambdaHome,lambdaAway:m.lambdaAway,recommendedBet:m.recommendedBet,actualScore:{home:f.hg,away:f.ag},outcome:gradeBet(m.recommendedBet,{home:f.hg,away:f.ag}),sources:[f.source,"https://www.soccerbase.com/matches/results.sd?date="+f.date]})}
 const wins=fixtures.filter(x=>x.outcome==="WIN").length,losses=fixtures.length-wins;
 const group=(key:(x:any)=>string)=>Object.values(fixtures.reduce((a:any,x:any)=>{const k=key(x);a[k]??={key:k,bets:0,wins:0,losses:0};a[k].bets++;a[k][x.outcome==="WIN"?"wins":"losses"]++;return a},{})).map((x:any)=>({...x,hitRate:+(100*x.wins/x.bets).toFixed(1)}));
 const leagueIds=[...new Set(rows.filter(r=>r.date>=FROM&&r.date<=TO).map(r=>r.leagueId))];
 const inRange=rows.filter(r=>r.date>=FROM&&r.date<=TO);
 const report={status:"complete-supported-web-scope",modelVersion:"v2.4-calibrated-risk-selector",range:{start:FROM,end:TO},researchMethod:"historical web data reconstructed chronologically; production lib/model.ts executed before grading",sourceScope:{configuredLeagueCount:61,webModelledLeagueCount:leagueIds.length,webModelledLeagueIds:leagueIds,note:"All fixtures found by the installed web adapters were processed. Configured leagues without an installed auditable adapter remain outside performance statistics."},fixtures,aggregateMetrics:{webFixturesInRange:inRange.length,modelledFixtures:modelled,noModel,noBet,recommendedBets:fixtures.length,wins,losses,hitRate:fixtures.length?+(100*wins/fixtures.length).toFixed(1):null,byPick:group(x=>x.recommendedBet.pick),byLeague:group(x=>x.leagueId),byRating:group(x=>x.recommendedBet.rating)},generatedAt:new Date().toISOString()};
 const out=path.join(process.cwd(),`data/backtests/${FROM}_to_${TO}.json`);fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({scope:report.sourceScope,metrics:report.aggregateMetrics},null,2))
}
main().catch(e=>{console.error(e);process.exit(1)});
