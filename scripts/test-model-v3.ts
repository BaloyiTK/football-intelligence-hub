import assert from "node:assert/strict";
import {calculateV3,V3_MODEL_VERSION} from "../lib/model-v3";

const x=calculateV3({homeAttack:1.55,awayAttack:.75,homeDefence:.70,awayDefence:1.35,leagueHomeGoals:1.5,leagueAwayGoals:1.15,sampleSize:8,modelLevel:"full",confidence:"high",competitionType:"club",homeRestDays:6,awayRestDays:3,homeAvailability:.95,awayAvailability:.80});
assert.equal(x.modelVersion,V3_MODEL_VERSION);
assert.equal(x.shadowOnly,true);
assert.equal(x.productionBaseline,"v2.9-market-specific-quality-selector");
assert.ok(Math.abs(x.home+x.draw+x.away-100)<.2);
assert.ok(Array.isArray(x.coherence.flags));
assert.ok(Number.isInteger(x.predictedScore.home)&&Number.isInteger(x.predictedScore.away));
console.log(JSON.stringify({status:"v3-shadow-tests-passed",modelVersion:V3_MODEL_VERSION,coherence:x.coherence}));
