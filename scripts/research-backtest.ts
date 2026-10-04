import fs from "node:fs";import path from "node:path";
type L={id:string};
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i<0?undefined:process.argv[i+1]},from=arg("--from"),to=arg("--to");
if(!from||!to)throw new Error("Usage: npm run backtest:research -- --from YYYY-MM-DD --to YYYY-MM-DD");
const root=process.cwd(), leagues=(JSON.parse(fs.readFileSync(path.join(root,"data/leagues.json"),"utf8")).leagues as L[]);
const fd:Record<string,string>={
"eng-premier-league":"E0","eng-championship":"E1","eng-league-one":"E2","eng-league-two":"E3","esp-la-liga":"SP1","esp-segunda":"SP2","ita-serie-a":"I1","ita-serie-b":"I2","ger-bundesliga":"D1","ger-2-bundesliga":"D2","fra-ligue-1":"F1","fra-ligue-2":"F2","ned-eredivisie":"N1","por-primeira-liga":"P1","bel-pro-league":"B1","sco-premiership":"SC0","tur-super-lig":"T1","gre-super-league":"G1"
};
const world=new Set(["arg-primera","bra-serie-a","bra-serie-b","chn-super-league","den-superliga","fin-veikkausliiga","jpn-j1","jpn-j2","mex-liga-mx","nor-eliteserien","pol-ekstraklasa","rou-liga-1","swe-allsvenskan","sui-super-league","usa-mls","aus-a-league","egy-premier-league","mar-botola"]);
const intl=new Set(["uefa-nations-league","fifa-world-cup","international-friendlies"]);
const season=(d:string)=>{const y=+d.slice(0,4),m=+d.slice(5,7);return m>=7?String(y).slice(2)+String(y+1).slice(2):String(y-1).slice(2)+String(y).slice(2)};
const csv=(s:string)=>{const [h,...rs]=s.trim().split(/\r?\n/);const k=h.split(",");return rs.map(r=>{const a=r.split(",");return Object.fromEntries(k.map((x,i)=>[x,a[i]]))})};
const fixtures:any[]=[],coverage:any[]=[];
for(const l of leagues){try{
 if(fd[l.id]){const url=`https://www.football-data.co.uk/mmz4281/${season(from)}/${fd[l.id]}.csv`;const r=await fetch(url);if(!r.ok)throw new Error("HTTP "+r.status);for(const x of csv(await r.text())){const p=(x.Date??"").split("/");if(p.length!==3)continue;const date=`${p[2].length===2?"20"+p[2]:p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;if(date<from||date>to||x.FTHG==="")continue;fixtures.push({date,kickoff:date+"T12:00:00Z",leagueId:l.id,homeTeam:x.HomeTeam,awayTeam:x.AwayTeam,homeGoals:+x.FTHG,awayGoals:+x.FTAG,source:url});}for(let d=new Date(from+"T00:00:00Z"),e=new Date(to+"T00:00:00Z");d<=e;d.setUTCDate(d.getUTCDate()+1))coverage.push({date:d.toISOString().slice(0,10),leagueId:l.id,verified:true,sources:[url]});continue}
 if(world.has(l.id)||intl.has(l.id)){coverage.push({leagueId:l.id,verified:false,sources:[],reason:"OpenFootball adapter requires repository-path mapping; use ChatGPT web fallback until mapped."});continue}
 coverage.push({leagueId:l.id,verified:false,sources:[],reason:"web-fallback"});
 }catch(e){coverage.push({leagueId:l.id,verified:false,sources:[],reason:String(e)})}}
const file=path.join(root,`data/backtest-evidence/${from}_to_${to}.source.json`);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({fixtures,coverage,provider:{footballData:"https://www.football-data.co.uk/",openFootball:"https://github.com/openfootball",webFallback:true}},null,2)+"\n");console.log(JSON.stringify({file:path.relative(root,file),fixtures:fixtures.length,verifiedCoverage:coverage.filter(x=>x.verified).length,fallback:coverage.filter(x=>!x.verified).length},null,2));
