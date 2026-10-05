export type Score={home:number;away:number};
export function parseScore(v:any):Score|null{
 if(v&&typeof v==="object"&&Number.isFinite(v.home)&&Number.isFinite(v.away))return{home:Number(v.home),away:Number(v.away)};
 if(typeof v==="string"){const m=v.match(/^(\d+)\s*[-–:]\s*(\d+)$/);if(m)return{home:Number(m[1]),away:Number(m[2])}}
 return null;
}
export function gradeBet(b:any,s:Score):"WIN"|"LOSS"{
 const t=s.home+s.away,m=b?.market,p=b?.pick;
 if(m==="Double Chance"){if(p==="1X")return s.home>=s.away?"WIN":"LOSS";if(p==="X2")return s.away>=s.home?"WIN":"LOSS";if(p==="12")return s.home!==s.away?"WIN":"LOSS"}
 if(m==="Total Goals"){if(p==="Over 1.5")return t>=2?"WIN":"LOSS";if(p==="Under 1.5")return t<=1?"WIN":"LOSS";if(p==="Over 2.5")return t>=3?"WIN":"LOSS";if(p==="Under 2.5")return t<=2?"WIN":"LOSS";if(p==="Over 3.5")return t>=4?"WIN":"LOSS";if(p==="Under 3.5")return t<=3?"WIN":"LOSS"}
 if(m==="BTTS"){if(p==="Yes")return s.home>0&&s.away>0?"WIN":"LOSS";if(p==="No")return s.home===0||s.away===0?"WIN":"LOSS"}
 if(m==="Team Goals"){if(p==="Home 1+")return s.home>=1?"WIN":"LOSS";if(p==="Away 1+")return s.away>=1?"WIN":"LOSS"}
 if(m==="1X2"){if(p==="Home")return s.home>s.away?"WIN":"LOSS";if(p==="Draw")return s.home===s.away?"WIN":"LOSS";if(p==="Away")return s.away>s.home?"WIN":"LOSS"}
 throw new Error(`Unsupported bet: ${m} / ${p}`);
}
