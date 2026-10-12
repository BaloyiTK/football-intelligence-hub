const eid=String(process.argv[2]||process.env.FIH_EID||"").trim();
if(!/^\d+$/.test(eid))throw new Error("FIH_EID_REQUIRED");

const candidates=[
  ["ls_api_key",process.env.LS_API_KEY_LOWER],
  ["LS_API_KEY",process.env.LS_API_KEY_UPPER],
  ["RAPIDAPI_KEY",process.env.RAPIDAPI_KEY]
];
const hit=candidates.find(([,value])=>String(value||"").trim());
if(!hit)throw new Error("NO_GITHUB_RAPIDAPI_SECRET_CONFIGURED");
const [secretName,key]=hit;

async function call(path){
  const u=new URL("https://livescore6.p.rapidapi.com"+path);
  u.searchParams.set("Category","soccer");
  u.searchParams.set("Eid",eid);
  const r=await fetch(u,{headers:{
    "X-RapidAPI-Key":key,
    "X-RapidAPI-Host":"livescore6.p.rapidapi.com",
    "Accept":"application/json"
  }});
  const text=await r.text();
  let body;
  try{body=JSON.parse(text)}catch{body={raw:text.slice(0,2000)}}
  return {status:r.status,ok:r.ok,body};
}

const pregameForm=await call("/matches/v2/get-pregame-form");
const h2h=await call("/matches/v2/get-h2h");
console.log(JSON.stringify({ok:pregameForm.ok||h2h.ok,eid,credentialSource:secretName,pregameForm,h2h},null,2));
if(!pregameForm.ok&&!h2h.ok)process.exitCode=1;
