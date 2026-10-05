async function main(){
 const url="https://football-predictions.ai/wanderers-vs-albion-fc-prediction-betting-tips-2026-09-28";
 const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 FIH-Odds-Probe/1.0"}});
 const t=await r.text();
 console.log("STATUS",r.status,"LEN",t.length);
 for(const term of ["Over 1.5","Home/Draw","Double Chance","Over/Under"]){
   const hits:number[]=[]; let p=-1;
   while((p=t.indexOf(term,p+1))>=0) hits.push(p);
   console.log("TERM",term,"COUNT",hits.length,"HITS",hits.slice(0,20));
   for(const [n,x] of hits.slice(-8).entries()) console.log("SNIP",term,n+1,x,t.slice(Math.max(0,x-450),x+1100).replace(/\s+/g," "));
 }
 const nuxt=[...t.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)];
 console.log("JSON_SCRIPTS",nuxt.length,nuxt.map((m:any)=>m[1].length));
}
main().catch(e=>{console.error(e);process.exit(1)});