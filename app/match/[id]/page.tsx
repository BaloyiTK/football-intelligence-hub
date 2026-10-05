import {matches} from "@/lib/demo";
import {notFound} from "next/navigation";

export default async function Match({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const m=matches.find(x=>x.id===Number(id));
  if(!m) notFound();
  const bet=m.recommendedBet;
  return <main>
    <nav><a href="/">← FI<span>H</span></a><div>Match Intelligence</div></nav>
    <section className="detail">
      <p className="eyebrow">{m.league} · {m.kickoff}</p>
      <h1>{m.homeTeam} <em>vs</em> {m.awayTeam}</h1>
      <p>Model confidence <mark>{m.confidence}/100 · {m.status}</mark></p>
      <div className="cards">
        <article><small>EXPECTED GOALS</small><b>{m.lambdaHome} — {m.lambdaAway}</b></article>
        <article><small>HOME / DRAW / AWAY</small><b>{m.home}% · {m.draw}% · {m.away}%</b></article>
        <article><small>DOUBLE CHANCE</small><b>1X {m.doubleChance.homeOrDraw}% · X2 {m.doubleChance.awayOrDraw}%</b></article>
        <article><small>OVER 1.5</small><b>{m.over15}%</b></article>
        <article><small>OVER 2.5</small><b>{m.over25}%</b></article>
        <article><small>RECOMMENDATION</small><b>{bet ? bet.pick + " · " + bet.probability + "%" : "NO BET"}</b></article>
      </div>
      <section className="report">
        <h2>Model</h2><p><strong>{m.modelVersion}</strong></p>
        <h2>Research pipeline</h2>
        <p className="muted">Fixture discovery → web research → statistics extraction → validation → λ calculation → Poisson matrix → market probabilities → confidence ranking → saved report.</p>
      </section>
    </section>
  </main>;
}
