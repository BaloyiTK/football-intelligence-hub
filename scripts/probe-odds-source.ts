function unflatten(input:any[]){
 const hydrated:any[] = new Array(input.length);
 const seen=new Set<number>();
 const hydrate=(idx:any):any=>{
   if(typeof idx!=="number") return idx;
   if(idx<0) return idx===-1?undefined:idx;
   if(idx>=input.length) return idx;
   if(seen.has(idx)) return hydrated[idx];
   const value=input[idx];
   if(value===null||typeof value!=="object") return value;
   seen.add(idx);
   const out:any=Array.isArray(value)?[]:{};
   hydrated[idx]=out;
   if(Array.isArray(value)) for(const x of value) out.push(hydrate(x));
   else for(const [k,v] of Object.entries(value)) out[k]=hydrate(v);
   return out;
 };
 return hydrate(0);
}
async function main(){
 const sm=await fetch("https://football-predictions.ai/sitemap.xml",{headers:{"user-agent":"Mozilla/5.0 FIH-Odds-Probe/1.0"}}).then(r=>r.text());
 console.log("SITEMAP",sm.replace(/\s+/g," ").slice(0,5000));
 const url="https://football-predictions.ai/wanderers-vs-albion-fc-prediction-betting-tips-2026-09-28";
 const t=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 FIH-Odds-Probe/1.0"}}).then(r=>r.text());
 const m=t.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
 if(!m) throw new Error("no payload");
 const root=unflatten(JSON.parse(m[1]));
 const data=(root as any)?.[1]?.data?.[1]??{};
 const match=Object.values(data).find((x:any)=>x&&x.odds) as any;
 console.log("ODDS_KEYS",Object.keys(match?.odds??{}));
 for(const k of Object.keys(match?.odds??{})){
   const market=match.odds[k];
   if(/double|over|under|goal/i.test(k)||/Double Chance|Over\/Under|Goals/i.test(market?.label??"")){
     console.log("MARKET",k,JSON.stringify(market));
   }
 }
}
main().catch(e=>{console.error(e);process.exit(1)});