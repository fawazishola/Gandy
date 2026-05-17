/* global React, useApp */
const { useState } = React;

function Topbar({ route, onNavigate }) {
  const links = [
    { id: "dashboard", label: "Dashboard" },
    { id: "repositories", label: "Repositories" },
    { id: "reports", label: "Reports" },
    { id: "settings", label: "Settings" },
  ];
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="logo" onClick={() => onNavigate("dashboard")} aria-label="Gandy home">
          <span className="logo-mark">G</span>
          <span>gandy</span>
        </button>
        <nav className="topbar-nav">
          {links.map(l => (
            <a key={l.id}
               className={route === l.id ? "active" : ""}
               onClick={() => onNavigate(l.id)}>
              {l.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="topbar-right">
        <button className="icon-btn" title="Search" onClick={() => alert("Search is not connected in this local demo yet.")}><IconSearch /></button>
        <button className="icon-btn" title="Notifications" onClick={() => alert("No new verification alerts.")} style={{ position: "relative" }}>
          <IconBell />
          <span style={{
            position: "absolute", top: 5, right: 5,
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)"
          }} />
        </button>
        <div className="avatar">JK</div>
      </div>
    </header>
  );
}

function Sidebar({ route, onNavigate, currentPR }) {
  const app = typeof useApp === "function" ? useApp() : null;
  const prs = app?.state?.pullRequests || [];
  const repos = app?.state?.repositories || [];
  const currentPull = prs.find((pr) => Number(pr.number) === Number(currentPR)) || prs.find((pr) => Number(pr.number) === 1);
  const currentRepo = repos.find((repo) => repo.id === currentPull?.repoId) || repos.find((repo) => repo.name === currentPull?.repo);
  const recentRuns = [
    { n: 1, t: "GovernanceFacet flash loan vulnerability", status: "fail" },
    { n: 47, t: "Refactor governance vote weight", status: "fail" },
    { n: 46, t: "Bump curve invariant precision", status: "pass" },
    { n: 45, t: "Add liquidity migration helper", status: "pass" },
    { n: 44, t: "Tighten oracle TWAP window", status: "warn" },
  ].map((run) => {
    const pr = prs.find((p) => Number(p.number) === run.n);
    return pr ? { ...run, t: pr.title } : run;
  });

  const [bobChatOpen, setBobChatOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">Repository</div>
        <div className="repo-pill" onClick={() => onNavigate("repositories")} style={{ cursor: "pointer" }}>
          <span className="dot" />
          <span className="name">{currentRepo?.name || "vortex-amm"}</span>
          <IconChevDown className="caret" />
        </div>
        <div className="sidebar-item active" onClick={() => onNavigate("dashboard")}>
          <IconHome />
          <span>Overview</span>
        </div>
        <div className="sidebar-item" onClick={() => onNavigate("dashboard")}>
          <IconGit />
          <span>Pull requests</span>
          <span className="badge">{prs.length || 8}</span>
        </div>
        <div className="sidebar-item" onClick={() => onNavigate("reports")}>
          <IconReport />
          <span>Reports</span>
          <span className="badge">142</span>
        </div>
        <div className="sidebar-item" onClick={() => onNavigate("settings")}>
          <IconShield />
          <span>Verification profile</span>
        </div>
        <div className="sidebar-item" onClick={() => onNavigate("settings")}>
          <IconCog />
          <span>Settings</span>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">Recent runs</div>
        {recentRuns.map(r => (
          <div className={`run-row ${Number(currentPR) === r.n ? "active" : ""}`} key={r.n} onClick={() => onNavigate("pr", { pr: r.n })}>
            <span className="pr-num">#{r.n}</span>
            <span className="pr-title">{r.t}</span>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: r.status === "pass" ? "var(--pass)"
                        : r.status === "fail" ? "var(--fail)"
                        : "var(--warn)"
            }} />
          </div>
        ))}
      </div>

      <div className="sidebar-section" style={{ marginTop: "auto" }}>
        <div style={{
          padding: "10px 12px",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-3)",
          background: "var(--bg-elev)",
          display: "flex", flexDirection: "column", gap: 6,
          fontSize: 11.5,
          cursor: "pointer",
          transition: "border-color 0.15s ease"
        }} 
        onClick={() => setBobChatOpen(!bobChatOpen)}
        onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
        onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--hairline)"}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text)", fontWeight: 500 }}>
            <span style={{
              width: 14, height: 14, borderRadius: 3,
              display: "inline-grid", placeItems: "center",
              background: "var(--accent-soft)", color: "var(--accent)",
              fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600
            }}>B</span>
            <span>{bobChatOpen ? "Close Bob Session" : "Bob is idle"}</span>
          </div>
          {!bobChatOpen && (
            <div style={{ color: "var(--text-mute)", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
              last activity · 2m ago
            </div>
          )}
        </div>

        {bobChatOpen && (
          <div style={{
            marginTop: 8,
            padding: "10px",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-3)",
            background: "var(--bg-elev)",
            display: "flex", flexDirection: "column", gap: 8,
            fontSize: 11.5,
            animation: "fade-in 0.2s ease"
          }}>
            <div style={{ color: "var(--text)", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>IBM Bob Assistant</span>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pass)", boxShadow: "0 0 6px var(--pass)" }} />
            </div>
            <div style={{ color: "var(--text-mute)", maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ background: "var(--bg)", padding: 8, borderRadius: 4, lineHeight: 1.4 }}>
                <span style={{ color: "var(--accent)", fontWeight: 600, display: "block", marginBottom: 2 }}>Bob</span>
                Hello! I'm Bob, the neurosymbolic engine. I've analyzed the latest PRs and game theory state for this repository. How can I help you navigate the audit or understand the Nash equilibrium results?
              </div>
            </div>
            <input 
              type="text" 
              placeholder="Ask Bob a question..." 
              style={{
                background: "var(--bg)", border: "1px solid var(--hairline)", 
                padding: "8px 10px", borderRadius: 4, color: "var(--text)", 
                fontSize: 11, outline: "none", width: "100%", boxSizing: "border-box"
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  alert("Live Bob integration is simulated in this local React demo. To view actual session logs and responses, check the bob_sessions/ directory!");
                  e.target.value = "";
                }
              }}
            />
          </div>
        )}
      </div>
    </aside>
  );
}

Object.assign(window, { Topbar, Sidebar });
