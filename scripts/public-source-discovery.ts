import {fetchPublicPage,publicSources} from "./public-research-adapter";
import {normalize,similarity,stripHtml} from "./public-research-extract";

export type DiscoveredPage={source:string;url:string;label:string;score:number};
const hrefRe=/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
function absolute(base:string,href:string){try{return new URL(href,base).toString()}catch{return null}}
function sameHost(a:string,b:string){try{return new URL(a).hostname===new URL(b).hostname}catch{return false}}
export async function discoverFixturePages(home:string,away:string){
 const found:DiscoveredPage[]=[];
 for(const source of publicSources()){
  try{
   const page=await fetchPublicPage(source.baseUrl);
   let m; while((m=hrefRe.exec(page.html))){
    const url=absolute(source.baseUrl,m[1]); if(!url||!sameHost(source.baseUrl,url))continue;
    const label=stripHtml(m[2]); if(!label)continue;
    const hs=similarity(home,label),as=similarity(away,label);
    const score=Math.max(hs,as);
    if(score>=.55)found.push({source:source.id,url,label:normalize(label),score});
   }
  }catch{}
 }
 return [...new Map(found.sort((a,b)=>b.score-a.score).map(x=>[x.url,x])).values()].slice(0,20);
}
