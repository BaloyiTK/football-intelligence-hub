export type MatchRow={date?:string;home:string;away:string;homeGoals:number;awayGoals:number;sourceUrl:string};
export const normalize=(s:string)=>s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(fc|cf|afc|sc|club|calcio)\b/g," ").replace(/[^a-z0-9]+/g," ").trim();
export function similarity(a:string,b:string){
 const A=new Set(normalize(a).split(" ").filter(Boolean)),B=new Set(normalize(b).split(" ").filter(Boolean));
 if(!A.size||!B.size)return 0; let hit=0; for(const x of A)if(B.has(x))hit++;
 return (2*hit)/(A.size+B.size);
}
export function fixtureScore(home:string,away:string,text:string){
 const t=normalize(text); return (similarity(home,t)+similarity(away,t))/2;
}
export function stripHtml(html:string){return html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();}
export function explicitScores(text:string,sourceUrl:string):MatchRow[]{
 const out:MatchRow[]=[]; const re=/([A-Za-zÀ-ž0-9 .'-]{2,50})\s+(\d{1,2})\s*[-–:]\s*(\d{1,2})\s+([A-Za-zÀ-ž0-9 .'-]{2,50})/g;
 let m; while((m=re.exec(text))&&out.length<50){const hg=Number(m[2]),ag=Number(m[3]);if(hg>20||ag>20)continue;out.push({home:m[1].trim(),away:m[4].trim(),homeGoals:hg,awayGoals:ag,sourceUrl});}
 return out;
}
export function teamSeries(team:string,rows:MatchRow[],limit=5){
 return rows.filter(r=>similarity(team,r.home)>=.55||similarity(team,r.away)>=.55).slice(0,limit).map(r=>({home:r.home,away:r.away,homeGoals:r.homeGoals,awayGoals:r.awayGoals,sourceUrl:r.sourceUrl}));
}
