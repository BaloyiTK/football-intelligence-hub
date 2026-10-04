import fs from "node:fs";import path from "node:path";
type League={id:string;name:string;country:string};
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i<0?undefined:process.argv[i+1]};
const from=arg("--from"),to=arg("--to"),source=arg("--source");
if(!from||!to||!source){console.error("Usage: npm run backtest:collect -- --from YYYY-MM-DD --to YYYY-MM-DD --source <verified-source.json>");process.exit(1)}
const root=process.cwd(),leagues=(JSON.parse(fs.readFileSync(path.join(root,"data/leagues.json"),"utf8")).leagues as League[]);
const dates:string[]=[];for(let d=new Date(from+"T00:00:00Z"),e=new Date(to+"T00:00:00Z");d<=e;d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10));
const input=JSON.parse(fs.readFileSync(path.join(root,source),"utf8"));
if(!Array.isArray(input.fixtures)||!Array.isArray(input.coverage))throw new Error("Source must contain fixtures[] and coverage[]");
const expected=new Set(dates.flatMap(date=>leagues.map(l=>date+"|"+l.id)));
const covered=new Set(input.coverage.filter((x:any)=>x.verified===true&&Array.isArray(x.sources)&&x.sources.length).map((x:any)=>x.date+"|"+x.leagueId));
const missing=[...expected].filter(k=>!covered.has(k));
for(const f of input.fixtures){const k=f.date+"|"+f.leagueId;if(!expected.has(k))throw new Error("Fixture outside requested universe: "+k);if(!covered.has(k))throw new Error("Fixture has no verified coverage: "+k);if(!Array.isArray(f.sources)||!f.sources.length)throw new Error("Fixture missing sources: "+f.homeTeam+" v "+f.awayTeam);if(f.modelLevel!=="no-model"&&!f.inputs)throw new Error("Modelled fixture missing inputs");}
const out=path.join(root,`data/backtest-evidence/${from}_to_${to}.json`);
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(input.fixtures,null,2)+"\n");
const manifest={range:{from,to},expectedLeagueDays:expected.size,verifiedLeagueDays:covered.size,missingLeagueDays:missing.length,missing,fixtures:input.fixtures.length,status:missing.length?"incomplete":"complete",source};
fs.writeFileSync(out.replace(/\.json$/,".coverage.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({evidence:path.relative(root,out),coverage:path.relative(root,out.replace(/\.json$/,".coverage.json")),...manifest},null,2));
if(missing.length)process.exit(2);
