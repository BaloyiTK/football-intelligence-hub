const target=String(process.argv[2]||process.env.FIH_DATE||"").trim();
if(!/^\d{4}-\d{2}-\d{2}$/.test(target))throw new Error("FIH_DATE_REQUIRED");

const rules=(await import("../config/fih-execution-rules.json",{with:{type:"json"}})).default;
const endpoint=String(rules.infrastructure?.liveScoreStep2?.historicalArchiveEndpoint||"").trim();
if(!endpoint)throw new Error("HISTORICAL_ARCHIVE_ENDPOINT_MISSING");

function monthsFor(date){
  const [y,m]=date.slice(0,7).split("-").map(Number);
  const current=`${y}-${String(m).padStart(2,"0")}`;
  const d=new Date(Date.UTC(y,m-2,1));
  const previous=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;
  return [previous,current];
}

async function oidcToken(){
  const u=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const t=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!u||!t)throw new Error("GITHUB_OIDC_ENV_MISSING");
  const sep=u.includes("?")?"&":"?";
  const r=await fetch(u+sep+"audience=fih-step2",{headers:{Authorization:"Bearer "+t}});
  if(!r.ok)throw new Error("GITHUB_OIDC_REQUEST_FAILED "+r.status);
  const j=await r.json();
  if(!j.value)throw new Error("GITHUB_OIDC_TOKEN_MISSING");
  return j.value;
}

const oidc=await oidcToken();
const results=[];
for(const month of monthsFor(target)){
  const u=new URL(endpoint);
  u.searchParams.set("month",month);
  const r=await fetch(u,{headers:{"x-fih-github-oidc":oidc}});
  const text=await r.text();
  if(!r.ok)throw new Error("HISTORY_HTTP_"+r.status+" "+month+" "+text.slice(0,2000));
  const j=JSON.parse(text);
  if(j.ok!==true||j.month!==month||!j.path||!j.commit||!Number.isInteger(j.matchCount))throw new Error("HISTORY_RESPONSE_INVALID "+month);
  results.push(j);
  console.log("HISTORY_MONTH_VERIFIED",month,j.matchCount,j.path,j.commit);
}
console.log(JSON.stringify({ok:true,target,months:results},null,2));
