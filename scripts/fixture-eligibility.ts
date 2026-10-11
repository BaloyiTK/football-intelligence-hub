export const MIN_RESEARCH_RUNWAY_MINUTES=60;
export const MIN_RESEARCH_RUNWAY_MS=MIN_RESEARCH_RUNWAY_MINUTES*60*1000;

export function kickoffMs(e:any){
  const raw=String(e?.Esd??e?.Epsd??e?.startTime??"");
  if(!/^\d{14}$/.test(raw))return NaN;
  return new Date(raw.slice(0,4)+"-"+raw.slice(4,6)+"-"+raw.slice(6,8)+"T"+raw.slice(8,10)+":"+raw.slice(10,12)+":"+raw.slice(12,14)+"+02:00").getTime();
}

const genericLowerDivision=[
  /\bserie\s+[b-d]\b/i,
  /\blaliga\s*2\b/i,
  /\bliga portugal\s*2\b/i,
  /\bliga\s*3\b/i,
  /\bligue\s*2\b/i,
  /\bsuper league\s*2\b/i,
  /\bj[23]\s*league\b/i,
  /\bk\s*league\s*2\b/i,
  /\b2\.?\s*bundesliga\b/i,
  /\b3\.?\s*liga\b/i,
  /\bsegunda\b/i,
  /\bprimera\s+division\s+rfef\b/i,
  /\bregionalliga\b/i,
  /\boberliga\b/i,
  /\busl championship\b/i,
  /\busl league one\b/i,
  /\bmls next pro\b/i,
  /\bprimera nacional\b/i,
  /\bfederal a\b/i,
  /\bprimera b(?:\s+metropolitana)?\b/i,
  /\bazadegan league\b/i,
  /\bykkosliiga\b/i,
  /\besiliiga\b/i,
  /\bsuperettan\b/i,
  /\bprva nl\b/i,
  /\bdivision intermedia\b/i,
  /\bliga de ascenso\b/i,
  /\bliga de expansion\b/i,
  /\bchallenger pro league\b/i,
  /\bpromotion league\b/i,
  /\bnacional b\b/i,
  /\bprimera premier\b/i,
  /\bliga premier\b/i,
  /\b2\.?\s*snl\b/i,
  /\bnb ii\b/i,
  /\bii liga\b/i,
  /\bliga ii\b/i,
  /\b2\.?\s*liga\b/i,
  /\b2nd lig\b/i,
  /\b2\.?\s*division\b/i,
  /\b3\.?\s*division\b/i,
  /\b3\.?\s*divisjon\b/i
];

const countryLowerDivision:Record<string,RegExp[]> = {
  "Belgium":[/\bNational Division 1\b/i],
  "Bosnia and Herzegovina":[/\b1st League\b/i],
  "China":[/\bLeague One\b/i],
  "Croatia":[/\bPrva NL\b/i],
  "Denmark":[/\b1st Division\b/i,/\b2nd Division\b/i,/\bDanmarksserien\b/i],
  "England":[/\bChampionship\b/i,/\bLeague One\b/i,/\bLeague Two\b/i],
  "Mexico":[/\bLiga de Expansion\b/i,/\bPrimera Premier\b/i,/\bLiga Premier\b/i],
  "Norway":[/\b1\. Division\b/i,/\b2\.?\s*Division\b/i,/\b3\.?\s*Divisjon\b/i],
  "Peru":[/\bLiga 2\b/i],
  "Poland":[/\bI Liga\b/i,/\bII Liga\b/i],
  "Republic of Korea":[/\bK3 League\b/i],
  "Scotland":[/\bChampionship\b/i,/\bLeague One\b/i,/\bLeague Two\b/i],
  "Serbia":[/\bPrva Liga\b/i],
  "Sweden":[/\bDivision 1\b/i,/\bDivision 2\b/i,/\bSuperettan\b/i],
  "Turkiye":[/\b1st Lig\b/i,/\b2nd Lig\b/i]
};

export function isLowerDivision(s:any){
  const country=String(s?.Cnm??s?.Csnm??"").trim();
  const labels=[s?.CompN,s?.Snm,s?.Scd].filter(Boolean).map((v:any)=>String(v));
  if(genericLowerDivision.some(re=>labels.some((label:string)=>re.test(label))))return true;
  return (countryLowerDivision[country]||[]).some(re=>labels.some((label:string)=>re.test(label)));
}

function structuralExclusion(e:any,s:any){
  const text=[s?.CompN,s?.Snm,s?.Cnm,e?.T1?.[0]?.Nm,e?.T2?.[0]?.Nm].filter(Boolean).join(" ").toLowerCase();
  if(/women|\bw\b/.test(text))return "WOMEN";
  if(/\bu[- ]?\d{2}\b|under[- ]?\d{2}|youth|primavera/.test(text))return "YOUTH";
  const teams=[e?.T1?.[0]?.Nm,e?.T2?.[0]?.Nm].filter(Boolean).join(" ").toLowerCase();
  if(/reserve|reserves|\bu23\b|\bu21\b|\bu20\b|\bu19\b|\bu18\b|\bu17\b|\bii\b|(?:^|\s)2$/.test(teams))return "RESERVE_OR_DEVELOPMENT";
  if(/university|academia|academy|akatemia|juniors?/.test(text))return "NON_SENIOR";
  if(isLowerDivision(s))return "LOWER_DIVISION";
  return null;
}

export function fixtureExclusion(e:any,s:any,opts:{mode:"PREDICTION"|"BACKTEST";boardFetchedAt?:string|null}){
  const status=String(e?.Eps??"").toUpperCase();
  if(opts.mode==="PREDICTION"&&status!=="NS")return "NOT_PREMATCH";
  const km=kickoffMs(e);
  if(opts.mode==="PREDICTION"){
    const fm=Date.parse(String(opts.boardFetchedAt||""));
    if(!Number.isFinite(km))return "PREDICTION_KICKOFF_UNVERIFIED";
    if(!Number.isFinite(fm)||km<=fm)return "PREMATCH_WINDOW_CLOSED";
    if(km-fm<MIN_RESEARCH_RUNWAY_MS)return "INSUFFICIENT_RESEARCH_RUNWAY";
  }
  const structural=structuralExclusion(e,s);
  if(structural)return structural;
  if(opts.mode==="BACKTEST"){
    const raw=String(e?.Esd??"");
    if(!/^\d{14}$/.test(raw))return "BACKTEST_KICKOFF_UNVERIFIED";
    const hhmm=Number(raw.slice(8,12));
    if(hhmm<=600)return "BACKTEST_KICKOFF_AT_OR_BEFORE_0600_SAST";
  }
  return null;
}
