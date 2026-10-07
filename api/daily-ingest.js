function sastDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
export default async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"GET or POST required"});
 const today=sastDate(),requested=String(req.query.date||today);
 if(requested!==today)return res.status(400).json({error:"daily ingest only accepts today's SAST date",today});
 const key=process.env.ls_api_key,raw=process.env.ls_api_url;
 if(!key||!raw)return res.status(500).json({error:"required production LiveScore configuration missing"});
 const base=/^https?:\/\//i.test(raw)?raw:"https://"+raw,u=new URL(base);
 if(u.pathname==="/"||u.pathname==="")u.pathname="/matches/v2/list-by-date";
 u.searchParams.set("Category","soccer");u.searchParams.set("Date",today.replace(/-/g,""));u.searchParams.set("Timezone","2");
 const lr=await fetch(u,{headers:{"X-RapidAPI-Key":key,"X-RapidAPI-Host":u.hostname}});
 if(!lr.ok)return res.status(502).json({error:"LiveScore fetch failed",status:lr.status});
 let payload;try{payload=await lr.json()}catch{return res.status(502).json({error:"LiveScore returned invalid JSON"})}
 const stages=Array.isArray(payload?.Stages)?payload.Stages:[],fixtureCount=stages.reduce((n,s)=>n+(Array.isArray(s?.Events)?s.Events.length:0),0);
 if(!stages.length||!fixtureCount)return res.status(502).json({error:"LiveScore board failed validation",stageCount:stages.length,fixtureCount});
 return res.status(200).json({schema:"fih-today-fixture-v1",date:today,timezone:"Africa/Johannesburg",provider:"LiveScore via RapidAPI",fetchedAt:new Date().toISOString(),stageCount:stages.length,fixtureCount,payload});
}