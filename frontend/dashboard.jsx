/* global React, useToast, useApp, exportToCSV, IconDownload, IconPlus */
const { useMemo } = React;

function HealthSpark() {
  // Synthetic 90-day score path that rises into the green band
  const pts = useMemo(() => {
    const n = 90;
    const arr = [];
    let v = 76;
    for (let i = 0; i < n; i++) {
      v += (Math.sin(i * 0.7) * 1.2) + (Math.cos(i * 0.3 + 1) * 0.8) + (i > 60 ? 0.12 : 0.04);
      v = Math.max(60, Math.min(98, v));
      arr.push(v);
    }
    // Force a clean final value
    arr[n - 1] = 92;
    return arr;
  }, []);

  const w = 760, hh = 120, pad = 6;
  const minV = 55, maxV = 100;
  const sx = (i) => pad + (i / (pts.length - 1)) * (w - pad * 2);
  const sy = (v) => pad + (1 - (v - minV) / (maxV - minV)) * (hh - pad * 2);
  const linePath = pts.map((v, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${sx(pts.length - 1).toFixed(1)} ${hh - pad} L${sx(0).toFixed(1)} ${hh - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${hh}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.74 0.16 152)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="oklch(0.74 0.16 152)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* threshold bands */}
      <rect x="0" y={sy(85)} width={w} height={sy(60) - sy(85)} fill="oklch(0.80 0.16 78 / 0.04)" />
      <line x1="0" x2={w} y1={sy(85)} y2={sy(85)} stroke="var(--hairline)" strokeDasharray="2 4" />
      <line x1="0" x2={w} y1={sy(60)} y2={sy(60)} stroke="var(--hairline)" strokeDasharray="2 4" />
      <text x="6" y={sy(85) - 4} fill="var(--text-faint)" fontSize="9" fontFamily="var(--font-mono)">85</text>
      <text x="6" y={sy(60) - 4} fill="var(--text-faint)" fontSize="9" fontFamily="var(--font-mono)">60</text>

      <path d={areaPath} fill="url(#sparkFill)" />
      <path d={linePath} fill="none" stroke="oklch(0.74 0.16 152)" strokeWidth="1.5" />
      {/* end dot */}
      <circle cx={sx(pts.length - 1)} cy={sy(pts[pts.length - 1])} r="3" fill="oklch(0.74 0.16 152)" />
      <circle cx={sx(pts.length - 1)} cy={sy(pts[pts.length - 1])} r="6" fill="oklch(0.74 0.16 152)" opacity="0.2" />
    </svg>
  );
}

function PRRow({ n, title, author, time, status, onClick }) {
  const statusMap = {
    pending: { cls: "", text: "Pending verification", dot: null },
    verifying: { cls: "run", text: "Verifying · stage 3 of 5" },
    pass: { cls: "pass", text: "Passed" },
    fail: { cls: "fail", text: "Failed" },
    patched: { cls: "pass", text: "Patched & passed" },
  };
  const s = statusMap[status];
  return (
    <div className="pr-row" onClick={onClick}>
      <span className="pr-id">#{n}</span>
      <div className="pr-main">
        <span className="pr-title">{title}</span>
        <span className="pr-meta">{author} · opened {time}</span>
      </div>
      <span className={`status ${s.cls}`}>
        <span className="dot" />
        {s.text}
      </span>
      <IconChevRight />
    </div>
  );
}

function DashboardScreen({ onNavigate }) {
  const toast = useToast();
  const [prFilter, setPrFilter] = React.useState("all");

  const activePulls = [
    { n: 47, title: "Refactor governance vote weight calculation", author: "@jules", time: "2h ago", status: "fail", target: 47 },
    { n: 1, title: "GovernanceFacet · Flash loan governance takeover", author: "@attacker", time: "just now", status: "pending", target: 1, mine: true },
    { n: 48, title: "Migrate fee tier router to dynamic curves", author: "@hannah", time: "3h ago", status: "verifying" },
    { n: 49, title: "Reduce LP withdrawal cooldown to 8 hours", author: "@drew", time: "5h ago", status: "pending" },
    { n: 50, title: "Patch: clamp emission rate per epoch", author: "@bob (auto)", time: "6h ago", status: "patched" },
    { n: 51, title: "Add chainlink staleness threshold flag", author: "@priya", time: "9h ago", status: "pass" },
  ];

  const visiblePulls = activePulls.filter((pr) => {
    if (prFilter === "failing") return pr.status === "fail";
    if (prFilter === "mine") return pr.mine;
    return true;
  });

  const selectPrFilter = (filter) => {
    setPrFilter(filter);
    toast.info(
      filter === "all" ? "Showing all active PRs" :
      filter === "failing" ? "Showing PRs that need security attention" :
      "Showing your assigned demo PR"
    );
  };

  const handleExport = () => {
    const healthData = [
      { Metric: 'Protocol Health Score', Value: '92/100', Period: 'Trailing 30 days' },
      { Metric: 'Change from Prior Period', Value: '+6', Period: 'Last 30 days' },
      { Metric: 'Total PRs Verified', Value: '47', Period: 'All time' },
      { Metric: 'Pass Rate', Value: '89%', Period: 'Last 30 days' },
      { Metric: 'Average Verification Time', Value: '4m 12s', Period: 'Last 30 days' },
      { Metric: 'Critical Failures Caught', Value: '3', Period: 'Last 30 days' }
    ];
    
    exportToCSV(healthData, `gandy-health-report-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Health report exported to CSV');
  };

  return (
    <main className="content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-sub">
            <span style={{ fontFamily: "var(--font-mono)" }}>vortex-amm</span>
            &nbsp;·&nbsp; AMM verification profile
            &nbsp;·&nbsp; <span style={{ color: "var(--pass)" }}>● connected</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExport}>
            <IconDownload /> Export
          </button>
          <button className="btn btn-sm" onClick={() => onNavigate("pr", { pr: 1 })}>
            <IconPlus /> New verification
          </button>
        </div>
      </div>

      {/* Health card */}
      <div className="card health-card" style={{ marginBottom: 14 }}>
        <div className="health-num">
          <span className="label">Protocol health</span>
          <span className="big">92</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mute)" }}>/ 100 · trailing 30d</span>
          <span className="delta">↑ 6 from prior period</span>
        </div>
        <div className="health-spark">
          <div className="health-spark-head">
            <span>Score · 90 days</span>
            <span style={{ display: "inline-flex", gap: 14 }}>
              <span><span style={{ color: "var(--pass)" }}>● </span>healthy ≥ 85</span>
              <span><span style={{ color: "var(--warn)" }}>● </span>caution 60–85</span>
              <span><span style={{ color: "var(--fail)" }}>● </span>at risk &lt; 60</span>
            </span>
          </div>
          <HealthSpark />
        </div>
      </div>

      <div className="row-3" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 14 }}>
        {[
          { k: "Runs · 30d", v: "284", d: "+18 vs prior period", c: "var(--text)" },
          { k: "Failures caught", v: "12", d: "4 critical · 8 advisory", c: "var(--warn)" },
          { k: "Avg loop iterations", v: "1.4", d: "median 1 · p95 3", c: "var(--text)" }
        ].map((s) => (
          <div className="card card-body" key={s.k}>
            <div className="card-sub">{s.k}</div>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 30, letterSpacing: "-0.03em",
              color: s.c, marginTop: 6, fontWeight: 500
            }}>{s.v}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mute)", marginTop: 4 }}>
              {s.d}
            </div>
          </div>
        ))}
      </div>

      {/* Active PRs */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div className="card-title">
            <IconGit />
            Active pull requests
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)", marginLeft: 6 }}>8 open</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={`btn btn-ghost btn-sm ${prFilter === "all" ? "active" : ""}`} onClick={() => selectPrFilter("all")}>All</button>
            <button className={`btn btn-ghost btn-sm ${prFilter === "failing" ? "active" : ""}`} onClick={() => selectPrFilter("failing")}>Failing</button>
            <button className={`btn btn-ghost btn-sm ${prFilter === "mine" ? "active" : ""}`} onClick={() => selectPrFilter("mine")}>Mine</button>
          </div>
        </div>
        <div className="pr-list">
          {visiblePulls.map((pr) => (
            <PRRow
              key={pr.n}
              n={pr.n}
              title={pr.title}
              author={pr.author}
              time={pr.time}
              status={pr.status}
              onClick={() => pr.target
                ? onNavigate("pr", { pr: pr.target })
                : toast.info(`PR #${pr.n} — full demo not loaded in this prototype yet.`)}
            />
          ))}
          {!visiblePulls.length && (
            <div style={{ padding: 18, color: "var(--text-mute)", fontSize: 12.5 }}>
              No pull requests match this filter.
            </div>
          )}
        </div>
      </div>

      <div className="row-2" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Recent verification runs</div>
            <span className="card-sub">last 10</span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>PR</th>
                <th>Math layer</th>
                <th>Game theory</th>
                <th style={{ textAlign: "center" }}>Loops</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["#1 GovernanceFacet flash-loan takeover", "pass", "fail", "—", "Needs review", 1],
                ["#47 Refactor governance vote weight", "pass", "fail", "—", "Needs review", 47],
                ["#46 Bump curve invariant precision", "pass", "pass", 1, "Passed", 46],
                ["#45 Add liquidity migration helper", "pass", "pass", 1, "Passed", 45],
                ["#44 Tighten oracle TWAP window", "pass", "warn", 2, "Patched", 44],
                ["#43 Slippage guard for batch swaps", "pass", "pass", 1, "Passed"],
                ["#42 Adjust fee redistribution split", "fail", "pass", 3, "Patched"],
                ["#41 Initialize quadratic vote curve", "pass", "fail", "—", "Reverted"],
              ].map((r, i) => (
                <tr key={i} onClick={() => r[5] ? onNavigate("pr", { pr: r[5] }) : toast.info(`Full report for ${r[0]} — open Reports tab to view all archived runs.`)} style={{ cursor: "pointer" }}>
                  <td style={{ color: "var(--text)" }}>
                    <span className="mono" style={{ marginRight: 8 }}>{r[0].split(" ")[0]}</span>
                    {r[0].split(" ").slice(1).join(" ")}
                  </td>
                  <td>
                    <span className="layer-cell mono">
                      <span style={{ width: 5, height: 5, borderRadius: "50%",
                                     background: r[1] === "pass" ? "var(--pass)" : r[1] === "fail" ? "var(--fail)" : "var(--warn)" }} />
                      {r[1] === "pass" ? "passed" : r[1] === "fail" ? "failed" : "advisory"}
                    </span>
                  </td>
                  <td>
                    <span className="layer-cell mono">
                      <span style={{ width: 5, height: 5, borderRadius: "50%",
                                     background: r[2] === "pass" ? "var(--pass)" : r[2] === "fail" ? "var(--fail)" : "var(--warn)" }} />
                      {r[2] === "pass" ? "passed" : r[2] === "fail" ? "failed" : "advisory"}
                    </span>
                  </td>
                  <td className="mono" style={{ textAlign: "center" }}>{r[3]}</td>
                  <td>
                    <span className={`status ${r[4] === "Passed" || r[4] === "Patched" ? "pass" : "fail"}`}>
                      <span className="dot" /> {r[4]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Vulnerability mix</div>
            <span className="card-sub">30d</span>
          </div>
          <div className="card-body">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Math layer
            </div>
            {[
              ["Algebraic invariant", 3, "var(--accent)"],
              ["Differential bounds", 1, "var(--accent)"],
              ["Stochastic / Monte Carlo", 4, "var(--accent)"],
            ].map(([k, v, c]) => (
              <div className="bar-row" key={k}>
                <span className="label">{k}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${v * 14}%`, background: c }} /></div>
                <span className="value">{v}</span>
              </div>
            ))}
            <div style={{ height: 12 }} />
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Game theory layer
            </div>
            {[
              ["Nash equilibrium", 2, "var(--fail)"],
              ["Mechanism design", 1, "var(--fail)"],
              ["Repeated games", 1, "var(--warn)"],
            ].map(([k, v, c]) => (
              <div className="bar-row" key={k}>
                <span className="label">{k}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${v * 22}%`, background: c }} /></div>
                <span className="value">{v}</span>
              </div>
            ))}
            <div className="divider" style={{ margin: "12px 0" }} />
            <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--text)", fontWeight: 500 }}>Cluster:</strong> Mechanism-design failures
              are concentrated on governance-related PRs. Consider running an audit pass on the
              <span style={{ fontFamily: "var(--font-mono)" }}> Governor.sol</span> family.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

Object.assign(window, { DashboardScreen });
