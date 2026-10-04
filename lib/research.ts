export type ResearchSource={title:string;url:string;snippet?:string};
export type MatchResearch={homeTeam:string;awayTeam:string;league?:string;recentHome?:string;recentAway?:string;h2h?:string;teamNews?:string;sources:ResearchSource[];researchedAt:string;quality:"sufficient"|"insufficient"};
export async function researchMatch(homeTeam:string,awayTeam:string):Promise<MatchResearch>{
 const key=process.env.TAVILY_API_KEY;
 if(!key)return{homeTeam,awayTeam,sources:[],researchedAt:new Date().toISOString(),quality:"insufficient"};
 const queries=[`${homeTeam} vs ${awayTeam} recent form results home away football`,`${homeTeam} ${awayTeam} H2H injuries team news football`];
 const sources:ResearchSource[]=[];
 for(const query of queries){const res=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},body:JSON.stringify({query,search_depth:"basic",max_results:5,topic:"general"})});if(!res.ok)continue;const data=await res.json() as {results?:Array<{title:string;url:string;content?:string}>};for(const r of data.results??[])if(!sources.some(s=>s.url===r.url))sources.push({title:r.title,url:r.url,snippet:r.content});}
 return{homeTeam,awayTeam,sources,researchedAt:new Date().toISOString(),quality:sources.length>=4?"sufficient":"insufficient"};
}