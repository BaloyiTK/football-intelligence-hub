import {pathToFileURL} from "node:url";
const DAY=86400000;
const fmt=d=>new Date(d).toISOString().slice(0,10);
const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&fmt(Date.parse(s+"T00:00:00Z"))===s;
const shift=(s,n)=>fmt(Date.parse(s+"T00:00:00Z")+n*DAY);
export function resolveCommand(command,now=new Date()){
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 const q=String(command).trim().toLowerCase().replace(/\s+/g," ");
 if(q==="status")return {action:"STATUS",date:today};
 const st=q.match(/^status (\d{4}-\d{2}-\d{2})$/);
 if(st){if(!valid(st[1]))throw Error("INVALID_DATE");return {action:"STATUS",date:st[1]};}
 let start,end;
 if(/^run (now|today)$/.test(q))start=end=today;
 else if(q==="run tomorrow")start=end=shift(today,1);
 else if(q==="run yesterday")start=end=shift(today,-1);
 else if(/^run \d{4}-\d{2}-\d{2}$/.test(q))start=end=q.slice(4);
 else {
  const relative=q.match(/^run (past|next) (\d+) days?$/);
  const range=q.match(/^run from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/);
  if(relative){const n=Number(relative[2]);if(!Number.isSafeInteger(n)||n<1||n>3660)throw Error("INVALID_RANGE_LENGTH");start=relative[1]==="past"?shift(today,1-n):today;end=relative[1]==="past"?today:shift(today,n-1);}
  else if(range){start=range[1];end=range[2];}
  else throw Error("UNKNOWN_COMMAND");
 }
 if(!valid(start)||!valid(end)||start>end)throw Error("INVALID_DATE_RANGE");
 const dates=[];for(let d=start;d<=end;d=shift(d,1)){dates.push({date:d,mode:d<today?"BACKTEST":"PREDICTION"});if(dates.length>3660)throw Error("RANGE_TOO_LARGE");}
 return {action:"RUN",today,start,end,dates};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(resolveCommand(process.argv.slice(2).join(" ")),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}
