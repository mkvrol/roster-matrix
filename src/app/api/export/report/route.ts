import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reportId = request.nextUrl.searchParams.get("id");
  if (!reportId) {
    return NextResponse.json({ error: "Missing report id" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const report = await prisma.savedReport.findFirst({
    where: { id: reportId, userId: user.id },
  });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const config = report.configuration as Record<string, any>;
  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const analystName = user.name ?? session.user.email ?? "Analyst";

  function fmtCap(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
    return `$${value}`;
  }

  function getScoreColor(score: number): string {
    if (score >= 90) return "#10b981";
    if (score >= 75) return "#60a5fa";
    if (score >= 60) return "#fbbf24";
    if (score >= 40) return "#a78bfa";
    return "#ef4444";
  }

  function getGrade(score: number): string {
    if (score >= 90) return "ELITE";
    if (score >= 75) return "STRONG";
    if (score >= 60) return "FAIR";
    if (score >= 40) return "BELOW";
    return "OVERPAID";
  }

  // Build HTML report
  const player = config.player;
  const valueScore = config.valueScore;
  const contract = config.contract;
  const stats = config.stats;
  const advanced = config.advanced;
  const projection = config.projection;
  const comparables = config.comparables;
  const notes = config.notes;
  const gmNote = config.gmNote;

  const scoreColor = valueScore ? getScoreColor(valueScore.overallScore) : "#64748b";
  const grade = valueScore ? (valueScore.grade ?? getGrade(valueScore.overallScore)) : "N/A";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${report.title} — Roster Matrix</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b0f19; color: #e2e8f0; padding: 40px; max-width: 800px; margin: 0 auto; }
    @media print { body { background: white; color: #1a1a1a; padding: 20px; } .no-print { display: none; } }
    .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 2px solid #dc2626; margin-bottom: 30px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-logo { background: #dc2626; color: white; width: 36px; height: 36px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }
    .brand-name { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
    .meta { text-align: right; font-size: 12px; color: #94a3b8; }
    .player-header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; }
    .player-photo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #334155; }
    .player-photo-placeholder { width: 80px; height: 80px; border-radius: 50%; background: #1e293b; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 600; color: #94a3b8; border: 2px solid #334155; }
    .player-info h1 { font-size: 24px; margin-bottom: 4px; }
    .player-info .sub { font-size: 14px; color: #94a3b8; }
    .score-section { display: flex; align-items: center; gap: 16px; margin-left: auto; }
    .score-circle { width: 72px; height: 72px; border-radius: 50%; border: 4px solid ${scoreColor}; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: ${scoreColor}; }
    .score-label { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 4px; background: ${scoreColor}20; color: ${scoreColor}; text-transform: uppercase; letter-spacing: 1px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; padding-bottom: 8px; border-bottom: 1px solid #1e293b; margin-bottom: 12px; }
    @media print { .section h2 { border-bottom-color: #e2e8f0; color: #666; } }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
    .stat-box { background: #1e293b; border-radius: 6px; padding: 10px 12px; }
    @media print { .stat-box { background: #f8f8f8; border: 1px solid #e2e8f0; } }
    .stat-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 2px; }
    @media print { .stat-box .label { color: #666; } }
    .stat-box .value { font-size: 16px; font-weight: 700; font-family: 'SF Mono', 'Menlo', monospace; }
    .gm-note { background: #1e293b; border-radius: 6px; padding: 16px; font-size: 14px; line-height: 1.6; color: #cbd5e1; }
    @media print { .gm-note { background: #f8f8f8; border: 1px solid #e2e8f0; color: #333; } }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    table th { text-align: left; padding: 6px 10px; border-bottom: 1px solid #334155; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
    table td { padding: 6px 10px; border-bottom: 1px solid #1e293b; }
    @media print { table th { border-bottom-color: #e2e8f0; color: #666; } table td { border-bottom-color: #e2e8f0; } }
    .confidence-bar { height: 8px; border-radius: 4px; background: #1e293b; margin-top: 4px; }
    @media print { .confidence-bar { background: #e2e8f0; } }
    .confidence-fill { height: 8px; border-radius: 4px; background: #dc2626; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
    @media print { .footer { border-top-color: #e2e8f0; } }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; }
    .print-btn:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>

  <div class="header">
    <div class="brand">
      <div class="brand-logo">CV</div>
      <div class="brand-name">ROSTER MATRIX</div>
    </div>
    <div class="meta">
      <div>${report.title}</div>
      <div>Analyst: ${analystName}</div>
      <div>${now}</div>
    </div>
  </div>

  ${player ? `
  <div class="player-header">
    ${player.headshotUrl
      ? `<img src="${player.headshotUrl}" alt="${player.fullName}" class="player-photo" />`
      : `<div class="player-photo-placeholder">${(player.fullName as string).split(" ").map((n: string) => n[0]).join("")}</div>`
    }
    <div class="player-info">
      <h1>${player.fullName}</h1>
      <div class="sub">${player.position}${player.team ? ` · ${player.team}` : ""} · Age ${player.age}</div>
    </div>
    ${valueScore ? `
    <div class="score-section">
      <div class="score-circle">${valueScore.overallScore}</div>
      <div>
        <div class="score-label">${grade}</div>
        ${valueScore.leagueRank ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px;">League #${valueScore.leagueRank}</div>` : ""}
      </div>
    </div>
    ` : ""}
  </div>
  ` : ""}

  ${contract ? `
  <div class="section">
    <h2>Contract Details</h2>
    <div class="stats-grid">
      <div class="stat-box"><div class="label">AAV</div><div class="value">${fmtCap(contract.aav)}</div></div>
      <div class="stat-box"><div class="label">Term</div><div class="value">${contract.totalYears} yr</div></div>
      <div class="stat-box"><div class="label">Years Left</div><div class="value">${contract.yearsRemaining}</div></div>
      <div class="stat-box"><div class="label">Period</div><div class="value">${contract.startYear}–${contract.endYear}</div></div>
      <div class="stat-box"><div class="label">NTC</div><div class="value">${contract.hasNTC ? "Yes" : "No"}</div></div>
      <div class="stat-box"><div class="label">NMC</div><div class="value">${contract.hasNMC ? "Yes" : "No"}</div></div>
      ${contract.signingType ? `<div class="stat-box"><div class="label">Type</div><div class="value">${contract.signingType}</div></div>` : ""}
    </div>
  </div>
  ` : ""}

  ${stats ? `
  <div class="section">
    <h2>Season Stats</h2>
    <div class="stats-grid">
      <div class="stat-box"><div class="label">GP</div><div class="value">${stats.gamesPlayed}</div></div>
      <div class="stat-box"><div class="label">Goals</div><div class="value">${stats.goals}</div></div>
      <div class="stat-box"><div class="label">Assists</div><div class="value">${stats.assists}</div></div>
      <div class="stat-box"><div class="label">Points</div><div class="value">${stats.points}</div></div>
      <div class="stat-box"><div class="label">+/−</div><div class="value">${stats.plusMinus >= 0 ? "+" : ""}${stats.plusMinus}</div></div>
      ${stats.toiPerGame != null ? `<div class="stat-box"><div class="label">TOI/GP</div><div class="value">${Number(stats.toiPerGame).toFixed(1)}</div></div>` : ""}
    </div>
  </div>
  ` : ""}

  ${valueScore?.estimatedWAR != null || advanced ? `
  <div class="section">
    <h2>Advanced Analytics</h2>
    <div class="stats-grid">
      ${valueScore?.estimatedWAR != null ? `<div class="stat-box"><div class="label">Est. WAR</div><div class="value">${Number(valueScore.estimatedWAR).toFixed(1)}</div></div>` : ""}
      ${advanced?.corsiForPct != null ? `<div class="stat-box"><div class="label">CF%</div><div class="value">${Number(advanced.corsiForPct).toFixed(1)}%</div></div>` : ""}
      ${advanced?.xGFPct != null ? `<div class="stat-box"><div class="label">xGF%</div><div class="value">${Number(advanced.xGFPct).toFixed(1)}%</div></div>` : ""}
      ${advanced?.goalsForPct != null ? `<div class="stat-box"><div class="label">GF%</div><div class="value">${Number(advanced.goalsForPct).toFixed(1)}%</div></div>` : ""}
    </div>
  </div>
  ` : ""}

  ${projection ? `
  <div class="section">
    <h2>Contract Projection</h2>
    <div class="stats-grid">
      <div class="stat-box"><div class="label">Projected AAV (Low)</div><div class="value">${fmtCap(projection.projectedAAV.low)}</div></div>
      <div class="stat-box"><div class="label">Projected AAV (Mid)</div><div class="value">${fmtCap(projection.projectedAAV.mid)}</div></div>
      <div class="stat-box"><div class="label">Projected AAV (High)</div><div class="value">${fmtCap(projection.projectedAAV.high)}</div></div>
      <div class="stat-box"><div class="label">Term (Low)</div><div class="value">${projection.projectedTerm.low} yr</div></div>
      <div class="stat-box"><div class="label">Term (Mid)</div><div class="value">${projection.projectedTerm.mid} yr</div></div>
      <div class="stat-box"><div class="label">Term (High)</div><div class="value">${projection.projectedTerm.high} yr</div></div>
      <div class="stat-box"><div class="label">Confidence</div><div class="value">${projection.confidence}%</div></div>
    </div>
    <div style="margin-top:12px;">
      <div class="confidence-bar"><div class="confidence-fill" style="width:${projection.confidence}%"></div></div>
    </div>
    ${(projection.comparables as any[]).length > 0 ? `
    <table style="margin-top:16px;">
      <thead><tr><th>Player</th><th>AAV</th><th>Term</th><th>Age</th><th>Production</th></tr></thead>
      <tbody>
        ${(projection.comparables as any[]).map((c: any) => `<tr><td>${c.playerName}</td><td style="font-family:monospace">${fmtCap(c.aav)}</td><td>${c.term} yr</td><td>${c.ageAtSigning}</td><td style="font-family:monospace">${c.productionAtSigning}</td></tr>`).join("")}
      </tbody>
    </table>
    ` : ""}
  </div>
  ` : ""}

  ${comparables ? `
  <div class="section">
    <h2>Peer Analysis</h2>
    <div class="stats-grid">
      <div class="stat-box"><div class="label">Rank</div><div class="value">#${comparables.rank}</div></div>
      <div class="stat-box"><div class="label">Percentile</div><div class="value">${comparables.percentile}%</div></div>
    </div>
    <div class="gm-note" style="margin-top:12px;">${comparables.summary}</div>
    ${(comparables.peers as any[]).length > 0 ? `
    <table style="margin-top:16px;">
      <thead><tr><th>Player</th><th>POS</th><th>Age</th><th>AAV</th><th>Term</th><th>Score</th><th>PTS</th><th>GP</th></tr></thead>
      <tbody>
        ${(comparables.peers as any[]).map((p: any) => `<tr><td>${p.playerName}</td><td>${p.position}</td><td>${p.age}</td><td style="font-family:monospace">${fmtCap(p.aav)}</td><td>${p.totalYears} yr</td><td style="font-family:monospace">${Number(p.valueScore).toFixed(1)}</td><td style="font-family:monospace">${p.points}</td><td style="font-family:monospace">${p.gamesPlayed}</td></tr>`).join("")}
      </tbody>
    </table>
    ` : ""}
  </div>
  ` : ""}

  ${notes ? `
  <div class="section">
    <h2>Notes</h2>
    <div class="gm-note">${notes}</div>
  </div>
  ` : ""}

  ${gmNote ? `
  <div class="section">
    <h2>GM Note</h2>
    <div class="gm-note">${gmNote}</div>
  </div>
  ` : ""}

  <div class="footer">
    <span>Roster Matrix — Confidential</span>
    <span>Generated ${now}${config.generatedAt ? ` · Report data from ${new Date(config.generatedAt as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</span>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${report.title.replace(/[^a-zA-Z0-9-_ ]/g, "")}.html"`,
    },
  });
}
