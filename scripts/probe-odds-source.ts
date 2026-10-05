async function main(){
const urls=[
  "https://football-predictions.ai/sitemap.xml",
  "https://football-predictions.ai/wanderers-vs-albion-fc-prediction-betting-tips-2026-09-28"
];
for(const url of urls){
  try{
    const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 FIH-Odds-Probe/1.0"}});
    const t=await r.text();
    console.log("URL",url,"STATUS",r.status,"LEN",t.length);
    for(const term of ["Over 1.5","Double Chance","1X","bookmakers","__NEXT_DATA__","odds"]){
      const i=t.toLowerCase().indexOf(term.toLowerCase());
      console.log("TERM",term,"IDX",i,i>=0?t.slice(Math.max(0,i-300),i+1200).replace(/\s+/g," "):"");
    }
  }catch(e){console.log("ERR",url,String(e))}
}
}
main().catch(e=>{console.error(e);process.exit(1)});
