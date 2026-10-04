export type Fixture={id:number;homeTeam:string;awayTeam:string;league:string;kickoff:string;utcDate:string;status:string;source:"football-data.org"};
type ApiMatch={id:number;utcDate:string;status:string;competition:{name:string};homeTeam:{name:string};awayTeam:{name:string}};
export async function getTodayFixtures(date=new Date()):Promise<Fixture[]>{
 const token=process.env.FOOTBALL_DATA_TOKEN;if(!token)return [];
 const day=date.toISOString().slice(0,10);
 const res=await fetch(`https://api.football-data.org/v4/matches?dateFrom=${day}&dateTo=${day}`,{headers:{"X-Auth-Token":token},next:{revalidate:1800}});
 if(!res.ok)throw new Error(`Fixture provider failed: ${res.status}`);
 const data=await res.json() as {matches:ApiMatch[]};
 return data.matches.map(m=>({id:m.id,homeTeam:m.homeTeam.name,awayTeam:m.awayTeam.name,league:m.competition.name,kickoff:new Intl.DateTimeFormat("en-ZA",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Africa/Johannesburg"}).format(new Date(m.utcDate)),utcDate:m.utcDate,status:m.status,source:"football-data.org"}));
}