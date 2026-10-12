const base=String(process.env.FIH_INGEST_BASE_URL||"").replace(/\/$/,"");
const eid=String(process.argv[2]||process.env.FIH_EID||"").trim();
if(!base)throw new Error("FIH_INGEST_BASE_URL_NOT_CONFIGURED");
if(!/^\d+$/.test(eid))throw new Error("FIH_EID_REQUIRED");

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
const response=await fetch(base+"/api/livescore-step2-probe?eid="+encodeURIComponent(eid),{
  headers:{"x-fih-github-oidc":oidc}
});
const text=await response.text();
if(!response.ok)throw new Error("PROBE_HTTP_"+response.status+" "+text.slice(0,2000));
const data=JSON.parse(text);
console.log(JSON.stringify(data,null,2));
