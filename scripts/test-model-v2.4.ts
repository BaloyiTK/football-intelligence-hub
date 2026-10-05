import assert from "node:assert/strict";
import {calculate,MODEL_VERSION} from "../lib/model";

assert.equal(MODEL_VERSION,"v2.8-support-quality-selector");

const normal=calculate({
  homeAttack:1.55,awayAttack:.75,homeDefence:.70,awayDefence:1.35,
  leagueHomeGoals:1.5,leagueAwayGoals:1.15,
  sampleSize:5,modelLevel:"basic",confidence:"low",competitionType:"international"
});
assert.equal(normal.modelVersion,MODEL_VERSION);
assert.ok(normal.recommendedBet,"normal supported fixture should remain publishable");
assert.equal(normal.recommendedBet?.publishable,true);
assert.ok((normal.recommendedBet?.selectionProbability??0)>0,"v2.6 must retain the pre-public-calibration selection probability for auditability");
assert.ok(["PUBLISH","WATCH"].includes(normal.recommendedBet?.selectionStatus??""));

const extreme=calculate({
  homeAttack:.20,awayAttack:2.8,homeDefence:1.8,awayDefence:.20,
  leagueHomeGoals:1.4,leagueAwayGoals:1.3,
  recentHomeAttack:.10,recentAwayAttack:3.2,
  recentHomeDefence:2.0,recentAwayDefence:.15,
  sampleSize:5,modelLevel:"basic",confidence:"low",competitionType:"friendly"
});
assert.equal(extreme.recommendedBet,null,"extreme lambda selection must not auto-publish");
assert.ok(extreme.reviewBet,"extreme directional signal should be retained for review");
assert.equal(extreme.reviewBet?.publishable,false);
assert.equal(extreme.reviewBet?.selectionStatus,"REVIEW");
assert.ok(extreme.reviewBet?.riskFlags.some(x=>["high-lambda","low-lambda","high-total-lambda"].includes(x)));

const marketConflict=calculate({
  homeAttack:1.7,awayAttack:.65,homeDefence:.70,awayDefence:1.4,
  leagueHomeGoals:1.5,leagueAwayGoals:1.15,
  sampleSize:8,modelLevel:"full",confidence:"high",competitionType:"club",
  marketProbabilityByPick:{"Double Chance|1X":40}
});
if(marketConflict.reviewBet){
  assert.equal(marketConflict.reviewBet.selectionStatus,"REVIEW");
  assert.equal(marketConflict.reviewBet.publishable,false);
  assert.ok(marketConflict.reviewBet.riskFlags.includes("extreme-market-divergence"));
}

const borderline=calculate({
  homeAttack:1.15,awayAttack:.82,homeDefence:.88,awayDefence:1.08,
  leagueHomeGoals:1.45,leagueAwayGoals:1.15,
  sampleSize:5,modelLevel:"basic",confidence:"low",competitionType:"club"
});
if(borderline.reviewBet?.riskFlags.includes("quality-public-probability")){
  assert.equal(borderline.reviewBet.publishable,false,"quality publication gate must quarantine sub-78 calibrated recommendations");
}
const weakSupport=calculate({
  homeAttack:1.22,awayAttack:.78,homeDefence:.9,awayDefence:1.08,
  leagueHomeGoals:1.45,leagueAwayGoals:1.15,
  sampleSize:5,modelLevel:"basic",confidence:"medium",competitionType:"club"
});
if(weakSupport.reviewBet?.riskFlags.includes("weak-support-margin")){
  assert.equal(weakSupport.reviewBet.publishable,false,"sub-5-point support margin must be review-only");
}
console.log(JSON.stringify({status:"v2.8-tests-passed",modelVersion:MODEL_VERSION}));
