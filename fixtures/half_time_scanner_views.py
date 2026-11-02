from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET

from .half_time_scanner import scan_zero_zero_half_time
from .services import fetch_fixtures


@require_GET
def half_time_scanner_api(request):
    try:
        fixtures = fetch_fixtures()
        candidates = scan_zero_zero_half_time(fixtures)
        return JsonResponse({
            "count": len(candidates),
            "candidates": candidates,
            "qualification_note": "QUALIFIES_FOR_REVIEW is a screening result, not a bet instruction. Confirm current odds and live evidence.",
        })
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=502)


@require_GET
def half_time_scanner_page(request):
    return HttpResponse(SCANNER_HTML)


SCANNER_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>0-0 Half-Time Scanner | Football Intelligence Hub</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0b1220;color:#e7edf7}
body{margin:0;padding:24px;max-width:1100px;margin-inline:auto}
header{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}
h1{font-size:clamp(24px,4vw,36px);margin:0}p{color:#9fb0c7;line-height:1.5}
button{background:#244d85;color:white;border:0;border-radius:9px;padding:11px 16px;font-weight:700}
#status{font-size:13px;color:#9fb0c7;margin:16px 0}
.card{background:#131f32;border:1px solid #2a3b54;border-radius:14px;padding:18px;margin:14px 0}
.match{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.score{font-size:24px;font-weight:800}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:14px}
.market{background:#0e1929;border-radius:10px;padding:13px}
.market h3{margin:0 0 8px;font-size:15px}.state{font-weight:800;color:#f5c76b}
ul{padding-left:18px;color:#b9c7d9;font-size:13px}small{color:#8396b1}
.empty{padding:35px;text-align:center;border:1px dashed #354963;border-radius:14px}
</style>
</head>
<body>
<header><div><h1>0-0 Half-Time Scanner</h1><p>Live matches at half-time, screened against pre-match team profiles and first-half evidence.</p></div><button id="refresh">Refresh now</button></header>
<div id="status">Loading live fixtures…</div><main id="matches"></main>
<script>
const statusEl=document.getElementById('status'), matchesEl=document.getElementById('matches');
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function renderMarket(title,data){const box=node('section',undefined,'market');box.append(node('h3',title));box.append(node('div',data.status.replaceAll('_',' '),'state'));const list=node('ul');(data.reasons||[]).forEach(reason=>list.append(node('li',reason)));box.append(list);return box}
async function refresh(){statusEl.textContent='Checking live fixtures…';try{const response=await fetch('/api/half-time-scanner/',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Scanner request failed');matchesEl.replaceChildren();statusEl.textContent='Last checked: '+new Date().toLocaleTimeString()+' · '+data.count+' matches at 0-0 half-time';if(!data.count){matchesEl.append(node('div','No 0-0 half-time matches detected right now. The scanner will check again automatically.','empty'));return}data.candidates.forEach(match=>{const card=node('article',undefined,'card');const top=node('div',undefined,'match');const name=node('strong',match.home_team+' vs '+match.away_team);const score=node('div',match.score+' · HALF-TIME','score');top.append(name,score);card.append(top);if(match.league)card.append(node('small',match.league));const grid=node('div',undefined,'grid');grid.append(renderMarket('Home or Draw (1X)',match.markets.home_or_draw_1x));grid.append(renderMarket('Under 2.5 Goals',match.markets.under_2_5));card.append(grid);matchesEl.append(card)})}catch(error){statusEl.textContent='Scanner unavailable: '+error.message}}
document.getElementById('refresh').addEventListener('click',refresh);refresh();setInterval(refresh,60000);
</script>
</body></html>"""
