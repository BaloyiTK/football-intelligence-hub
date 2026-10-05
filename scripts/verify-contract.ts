import fs from "node:fs";
const c=JSON.parse(fs.readFileSync("automation/FIH_CONTRACT.json","utf8"));
if(JSON.stringify(c.markets.requiredFamilies)!==JSON.stringify(["1X2"])) throw new Error("Canonical market scope must be 1X2 only");
if(JSON.stringify(c.markets.actionable?.["1X2"])!==JSON.stringify(["Home","Draw","Away"])) throw new Error("1X2 picks must be Home/Draw/Away");
if(c.mutationPolicy.runtimeRuleCreation!=="forbidden") throw new Error("Runtime rule creation must remain forbidden");
if(c.selfCorrection.mayChangeBusinessRules!==false) throw new Error("Self-correction may not change business rules");
if(c.invariants.only1X2RequiredForEveryModelledFixture!==true) throw new Error("1X2-only invariant must remain enabled");
if(c.markets.maximumRecommendedBetsPerFixture!==1) throw new Error("One-bet invariant changed");
console.log(JSON.stringify({status:"contract-verified",contractVersion:c.contractVersion,modelVersion:c.production.modelVersion,markets:c.markets.requiredFamilies}));
