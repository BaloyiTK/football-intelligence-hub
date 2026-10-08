import {validateResearchArtifact} from "./research-canonical";

const date="2099-01-01",rid="research:2099-01-01:test",id="fx1";
const attempt=(outcome:string)=>[{query:"Alpha Beta evidence search",attemptedAt:"2098-12-31T12:00:00.000Z",outcome}];
const unavailable=(outcome:string,exhausted:boolean,extra:any={})=>({status:"UNAVAILABLE",attempts:attempt(outcome),sourceRefs:[],searchExhausted:exhausted,...extra});
const record=(outcome:string,exhausted:boolean)=>({
 fixtureId:id,
 fixture:{home:"Alpha",away:"Beta",competition:"Test League",kickoff:"20990101120000"},
 researchedAt:"2098-12-31T12:01:00.000Z",
 researchRunId:rid,
 sourceMetadata:[],
 facts:{
  form:unavailable(outcome,exhausted),
  standings:unavailable(outcome,exhausted),
  headToHead:unavailable(outcome,exhausted,{data:{matches:[]}}),
  squadAvailability:unavailable(outcome,exhausted),
  schedule:unavailable(outcome,exhausted),
  competitionContext:unavailable(outcome,exhausted)
 }
});
const artifact=(r:any)=>({schema:"fih-daily-research-v5",date,mode:"PREDICTION",generatedAt:"2098-12-31T12:02:00.000Z",researchRunId:rid,fixtureCount:1,fixtures:[r]});

function mustReject(name:string,r:any,needle?:string){
 try{validateResearchArtifact(artifact(r),date,[id],"PREDICTION");}
 catch(e:any){
  const m=String(e?.message||e);
  if(needle&&!m.includes(needle))throw new Error(name+" rejected for wrong reason: "+m);
  return;
 }
 throw new Error(name+" unexpectedly passed");
}
mustReject("synthetic completion marker",record("CHATGPT_WEB_SEARCH_REFRESH_COMPLETED",true),"RESEARCH_SYNTHETIC_COMPLETION_MARKER_FORBIDDEN");
mustReject("non-exhausted unavailable",record("NO_VERIFIABLE_EVIDENCE",false),"RESEARCH_RECORD_INCOMPLETE");
validateResearchArtifact(artifact(record("SEARCH_EXHAUSTED_NO_VERIFIABLE_EVIDENCE",true)),date,[id],"PREDICTION");

console.log(JSON.stringify({ok:true,lock:"STEP2_ACTUAL_CAPTURE_FAILURE_INJECTION",syntheticCompletionRejected:true,nonExhaustedUnavailableRejected:true,genuineExhaustionAccepted:true},null,2));
