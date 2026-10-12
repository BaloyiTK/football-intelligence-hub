import {chromium} from "playwright";

const pages=[
 {id:"competition",url:"https://www.soccerway.com/ukraine/premier-league/",needles:["Livyi Bereg","Zorya"]},
 {id:"standings",url:"https://www.soccerway.com/ukraine/premier-league/standings/",needles:["Livyi Bereg","Zorya"]},
 {id:"match",url:"https://www.soccerway.com/match/livyi-bereg-WUaDzzzG/zorya-j9Wy32w4/",needles:["Livyi Bereg","Zorya","H2H"]}
];
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({userAgent:"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36"});
for(const target of pages){
 const page=await context.newPage();
 const responses:any[]=[];
 page.on("response",r=>{const u=r.url();if(/soccerway|flashscore|livesport/i.test(u)&&/json|feed|api|event|match|stand/i.test(u))responses.push({status:r.status(),url:u});});
 await page.goto(target.url,{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForTimeout(7000);
 const text=await page.locator("body").innerText().catch(()=> "");
 const snippets:any={};
 for(const needle of target.needles){
  const i=text.toLowerCase().indexOf(needle.toLowerCase());
  snippets[needle]=i>=0?text.slice(Math.max(0,i-600),i+1800):null;
 }
 console.log(JSON.stringify({id:target.id,url:target.url,title:await page.title(),bytes:text.length,snippets,responseCount:responses.length,responses:responses.slice(0,20)},null,2));
 await page.close();
 await new Promise(r=>setTimeout(r,6500));
}
await browser.close();
