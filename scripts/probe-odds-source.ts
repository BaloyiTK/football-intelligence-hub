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
   const out=Array.isArray(value)?[]:{};
   hydrated[idx]=out;
   if(Array.isArray(value)) for(const x of value) out.push(hydrate(x));
   else for(const [k,v] of Object.entries(value)) out[k]=hydrate(v);
   return out;
 };
 return hydrate(0);
}
async function main(){
 const url="https://football-predictions.ai/wanderers-vs-albion-fc-prediction-betting-tips-2026-09-28";
 const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 FIH-Odds-Probe/1.0"}});
 const t=await r.text();
 const m=t.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
 if(!m) throw new Error("no payload");
 const flat=JSON.parse(m[1]);
 const root=unflatten(flat);
 console.log("ROOT_KEYS",Object.keys(root||{}));
 const found:any[]=[]; const visited=new Set<any>();
 const walk=(x:any,path:string)=>{
   if(!x||typeof x!=="object"||visited.has(x)||found.length>100)return;visited.add(x);
   if(typeof x.label==="string" && /Double Chance|Over\/Under|Goals Over\/Under/i.test(x.label)){
     found.push({path,label:x.label,values:x.values});
   }
   for(const [k,v] of Object.entries(x)) walk(v,path+"."+k);
 };
 walk(root,"$");
 console.log("FOUND_COUNT",found.length);
 for(const x of found.slice(0,50)) console.log("FOUND",JSON.stringify(x));
}
main().catch(e=>{console.error(e);process.exit(1)});