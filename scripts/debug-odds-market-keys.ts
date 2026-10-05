export {};
function unflatten(input:any[]){
 const hydrated:any[]=new Array(input.length),seen=new Set<number>();
 const hydrate=(idx:any):any=>{
  if(typeof idx!=="number")return idx;if(idx<0)return idx===-1?undefined:idx;if(idx>=input.length)return idx;
  if(seen.has(idx))return hydrated[idx];const value=input[idx];if(value===null||typeof value!=="object")return value;
  seen.add(idx);const out:any=Array.isArray(value)?[]:{};hydrated[idx]=out;
  if(Array.isArray(value))for(const x of value)out.push(hydrate(x));else for(const [k,v] of Object.entries(value))out[k]=hydrate(v);return out;
 };return hydrate(0);
}
const urls=[
 "https://football-predictions.ai/ilves-vs-ff-jaro-prediction-betting-tips-2026-06-17",
 "https://football-predictions.ai/switzerland-vs-bosnia-herzegovina-prediction-betting-tips-2026-06-18",
 "https://football-predictions.ai/brann-vs-start-prediction-betting-tips-2026-07-12",
 "https://football-predictions.ai/guadalajara-chivas-vs-toluca-prediction-betting-tips-2026-07-19"
];
async function main(){
 for(const url of urls){
  const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 FIH-Odds-Debug/1.0"}});
  const html=await r.text(); const m=html.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
  console.log("\nURL",url,"STATUS",r.status,"LEN",html.length);
  if(!m){console.log("NOJSON");continue}
  const root=unflatten(JSON.parse(m[1])); const found:any[]=[]; const seen=new Set<any>();
  const walk=(x:any,path:string)=>{
   if(!x||typeof x!=="object"||seen.has(x))return;seen.add(x);
   if(x.odds&&typeof x.odds==="object") found.push({path,keys:Object.keys(x.odds),odds:x.odds});
   for(const [k,v] of Object.entries(x))walk(v,path+"."+k);
  }; walk(root,"$");
  console.log("ODDS_OBJECTS",found.length);
  for(const o of found.slice(0,4)){
   console.log("PATH",o.path,"KEYS",o.keys);
   for(const [k,v] of Object.entries(o.odds as any)){
    const q:any=v;
    if(q&&typeof q==="object"&&Array.isArray(q.values)){
      const vals=q.values.filter((z:any)=>/Home\/Draw|Over 1\.5/i.test(String(z?.value))).slice(0,6);
      if(vals.length) console.log("MATCHMARKET",k,q.label,JSON.stringify(vals));
    }
   }
  }
 }
}
main().catch(e=>{console.error(e);process.exit(1)});