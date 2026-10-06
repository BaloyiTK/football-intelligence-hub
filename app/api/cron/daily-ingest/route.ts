import {NextRequest,NextResponse} from "next/server";
import {ingestTodayFixtures,ingestTodayNews} from "@/lib/daily-ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

function sastDate() {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

export async function POST(req: NextRequest) {
  const secret = process.env.FIH_CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({error:"Unauthorized"},{status:401});
  }
  const date = sastDate();
  try {
    const fixtures = await ingestTodayFixtures(date);
    let news:any;
    try { news = await ingestTodayNews(date); }
    catch (error) { news = {ok:false,error:error instanceof Error?error.message:"News ingestion failed"}; }
    return NextResponse.json({ok:true,date,fixtures,news});
  } catch (error) {
    return NextResponse.json({ok:false,date,error:error instanceof Error?error.message:"Daily ingestion failed"},{status:502});
  }
}
