/* global React, ReactDOM */
const { useState, useEffect, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#ffffff",
  "pipelineState": "auto",
  "protocolType": "AMM",
  "screen": "pr"
}/*EDITMODE-END*/;

const ACCENT_PALETTES = {
  "#ffffff": { soft: "rgba(255,255,255,0.08)", line: "rgba(255,255,255,0.20)", glow: "rgba(255,255,255,0.30)" },
};

function AppContent() {
  const [route, setRoute] = useState({ id: "pr", params: { pr: 1 } });
  const [tweaks, setTweak] = (typeof useTweaks === "function")
    ? useTweaks(TWEAK_DEFAULTS)
    : [TWEAK_DEFAULTS, () => {}];

  // Sync screen tweak → route
  useEffect(() => {
    if (tweaks.screen && tweaks.screen !== route.id) {
      setRoute({ id: tweaks.screen, params: tweaks.screen === "pr" ? { pr: 47 } : {} });
    }
  }, [tweaks.screen]);

  // Apply accent palette
  useEffect(() => {
    const hex = (tweaks.accent || "#ffffff").toLowerCase();
    const p = ACCENT_PALETTES[hex] || ACCENT_PALETTES["#ffffff"];
    document.documentElement.style.setProperty("--accent", hex);
    document.documentElement.style.setProperty("--accent-soft", p.soft);
    document.documentElement.style.setProperty("--accent-line", p.line);
    document.documentElement.style.setProperty("--accent-glow", p.glow);
  }, [tweaks.accent]);

  const navigate = (id, params = {}) => {
    setRoute({ id, params });
    setTweak("screen", id);
    window.scrollTo({ top: 0 });
  };

  // Landing has its own chrome
  if (route.id === "landing") {
    return <>
      <div className="app-bg" />
      <LandingShell onNavigate={navigate} />
      <TweaksUI tweaks={tweaks} setTweak={setTweak} />
    </>;
  }

  return (
    <div className="shell">
      <div className="app-bg" />
      <Topbar route={route.id} onNavigate={navigate} />
      <div className="shell-main">
        <Sidebar route={route.id} onNavigate={navigate} currentPR={route.params.pr} />
        {route.id === "dashboard" && <DashboardScreen onNavigate={navigate} />}
        {route.id === "pr" && (
          <PRDetailScreen
            key={`pr-${tweaks.pipelineState}-${route.params.pr || "unknown"}`}
            onNavigate={navigate}
            prId={route.params.pr}
            forcedStatus={tweaks.pipelineState === "auto" ? null : tweaks.pipelineState}
          />
        )}
        {route.id === "reports" && <ReportsScreen />}
        {route.id === "repositories" && <RepositoriesScreen onNavigate={navigate} />}
        {route.id === "settings" && <SettingsScreen />}
      </div>
      <TweaksUI tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

function StubScreen({ title, desc }) {
  return (
    <main className="content">
      <h1 className="page-title">{title}</h1>
      <p className="page-sub">{desc}</p>
      <div style={{
        marginTop: 20, padding: 40, textAlign: "center",
        border: "1px dashed var(--hairline-strong)",
        borderRadius: "var(--r-4)", background: "var(--surface)"
      }}>
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-mute)", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          screen stubbed for v1 demo
        </div>
        <div style={{ marginTop: 10, color: "var(--text-dim)", fontSize: 12.5 }}>
          The Dashboard and the PR Verification page are the centerpieces of this prototype.
        </div>
      </div>
    </main>
  );
}

function TweaksUI({ tweaks, setTweak }) {
  if (typeof TweaksPanel === "undefined") return null;
  return (
    <TweaksPanel title="Tweaks" defaultOpen={false}>
      <TweakSection label="View">
        <TweakSelect
          label="Screen"
          value={tweaks.screen}
          onChange={v => setTweak("screen", v)}
          options={[
            { value: "landing", label: "Landing page" },
            { value: "dashboard", label: "Dashboard" },
            { value: "pr", label: "PR verification (#47)" },
          ]}
        />
      </TweakSection>

      <TweakSection label="Pipeline">
        <TweakSelect
          label="State"
          value={tweaks.pipelineState}
          onChange={v => setTweak("pipelineState", v)}
          options={[
            { value: "auto",    label: "Idle · click Verify" },
            { value: "running", label: "Running (animate)" },
          ]}
        />
        <div style={{ fontSize: 11, color: "var(--text-mute)", lineHeight: 1.5, marginTop: 4 }}>
          On PR #47 the first run fails (mechanism-design dominance). Accept the patch to re-verify and pass.
        </div>
      </TweakSection>

      <TweakSection label="Accent">
        <TweakColor
          label="Palette"
          value={tweaks.accent}
          onChange={v => setTweak("accent", v)}
          options={Object.keys(ACCENT_PALETTES)}
        />
      </TweakSection>

      <TweakSection label="Protocol">
        <TweakRadio
          label="Profile"
          value={tweaks.protocolType}
          onChange={v => setTweak("protocolType", v)}
          options={["AMM", "Lending", "Staking", "Governance"]}
        />
        <div style={{ fontSize: 11, color: "var(--text-mute)", lineHeight: 1.5, marginTop: 4 }}>
          Cosmetic in this demo — would change which frameworks the math/game layers prioritize.
        </div>
      </TweakSection>
    </TweaksPanel>
  );
}

function AppWrapper() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AppProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AppWrapper />);
