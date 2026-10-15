import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/queries';
import { geminiEnabled } from '@/lib/ai/gemini';
import { afEnabled, afQuotaLeft } from '@/lib/providers/apiFootball';
import { oaEnabled, oaLeft } from '@/lib/providers/theOddsApi';
import { xgCoverage } from '@/lib/ingest/xg';
import { sportCounts } from '@/lib/ingest/sports';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: { ...getHealth(), xg: xgCoverage(), sports: sportCounts() },
    providers: {
      espn: true,
      gemini: geminiEnabled(),
      apiFootball: afEnabled()
        ? { enabled: true, left: afQuotaLeft(), purpose: 'xG' }
        : { enabled: false, purpose: 'xG' },
      oddsApi: oaEnabled() ? { enabled: true, left: oaLeft() } : { enabled: false },
    },
  });
}
