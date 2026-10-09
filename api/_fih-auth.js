import crypto from "node:crypto";

const ISSUER="https://token.actions.githubusercontent.com";
const AUDIENCE="fih-step2";
let jwksCache=null;

const b64url=s=>Buffer.from(String(s).replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(String(s).length/4)*4,"="),"base64");
const jsonPart=s=>JSON.parse(b64url(s).toString("utf8"));
async function jwks(){
  if(jwksCache)return jwksCache;
  const r=await fetch(ISSUER+"/.well-known/jwks");
  if(!r.ok)throw new Error("GITHUB_OIDC_JWKS_HTTP_"+r.status);
  jwksCache=await r.json();
  return jwksCache;
}
function audOk(a){return Array.isArray(a)?a.includes(AUDIENCE):a===AUDIENCE}
export async function verifyFihGitHubOidc(token){
  const parts=String(token||"").split(".");
  if(parts.length!==3)throw new Error("GITHUB_OIDC_FORMAT_INVALID");
  const header=jsonPart(parts[0]),payload=jsonPart(parts[1]);
  if(header.alg!=="RS256"||!header.kid)throw new Error("GITHUB_OIDC_HEADER_INVALID");
  const set=await jwks(),jwk=(set.keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA");
  if(!jwk)throw new Error("GITHUB_OIDC_KEY_NOT_FOUND");
  const key=crypto.createPublicKey({key:jwk,format:"jwk"});
  const ok=crypto.verify("RSA-SHA256",Buffer.from(parts[0]+"."+parts[1]),key,b64url(parts[2]));
  if(!ok)throw new Error("GITHUB_OIDC_SIGNATURE_INVALID");
  const now=Math.floor(Date.now()/1000);
  if(payload.iss!==ISSUER||!audOk(payload.aud)||!Number.isFinite(payload.exp)||payload.exp<now-30||(payload.nbf&&payload.nbf>now+30))throw new Error("GITHUB_OIDC_CLAIMS_INVALID");
  const owner=process.env.FIH_GITHUB_OWNER||process.env.VERCEL_GIT_REPO_OWNER;
  const repo=process.env.FIH_GITHUB_REPO||process.env.VERCEL_GIT_REPO_SLUG;
  if(!owner||!repo||payload.repository!==owner+"/"+repo)throw new Error("GITHUB_OIDC_REPOSITORY_MISMATCH");
  const expectedRef=process.env.FIH_GITHUB_REF||"refs/heads/main";
  if(payload.ref!==expectedRef)throw new Error("GITHUB_OIDC_REF_MISMATCH");
  return payload;
}
export async function requireFihGitHubOidc(req,res){
  const token=req.headers?.["x-fih-github-oidc"]||req.headers?.["X-FIH-GITHUB-OIDC"];
  if(!token){res.status(401).json({error:"GITHUB_OIDC_REQUIRED"});return null}
  try{return await verifyFihGitHubOidc(token)}
  catch(e){res.status(403).json({error:"GITHUB_OIDC_REJECTED",detail:String(e?.message||e)});return null}
}
