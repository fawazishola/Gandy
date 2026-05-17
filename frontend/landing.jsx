/* global React */

function LandingScreen({ onNavigate }) {
  return (
    <main className="landing">
      <div className="ns-hero-video-wrap" style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '120vh', zIndex: 0, overflow: 'hidden'}}>
        <video
          autoPlay
          loop
          muted
          playsInline
          className="ns-hero-video"
          src="./hero-video.mp4"
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        ></video>
      </div>
      <section className="ns-hero" style={{position: 'relative', zIndex: 10}}>
        <div className="ns-hero-container">

          <div className="ns-hero-text">
            <h1>Develop 10x Faster with Gandy</h1>
            <p>The ultimate CI/CD platform that verifies the economics of your smart contracts. Catch logic exploits instantly and ship DeFi protocols with mathematically proven security.</p>
            <div className="ns-hero-cta">
              <button className="btn btn-primary btn-lg" onClick={() => onNavigate("dashboard")}>
                Connect Repository <IconChevRight size={14} />
              </button>
              <button className="btn btn-ghost btn-lg" onClick={() => alert("View Live Demo is not connected in this local demo.")}>
                View Live Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="ns-logos">
        <div className="ns-logos-container">
          <div className="ns-logos-label">
            <p>Powering the best teams</p>
          </div>
          <div className="ns-logos-track-wrap">
            <div className="ns-logos-track">
              <img src="https://cdn.simpleicons.org/ethereum/white" alt="Ethereum" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/solana/white" alt="Solana" style={{ height: 20 }} />
              <img src="https://cdn.simpleicons.org/uniswap/white" alt="Uniswap" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/chainlink/white" alt="Chainlink" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/github/white" alt="GitHub" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/rust/white" alt="Rust" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/solidity/white" alt="Solidity" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/polygon/white" alt="Polygon" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/ethereum/white" alt="Ethereum" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/solana/white" alt="Solana" style={{ height: 20 }} />
              <img src="https://cdn.simpleicons.org/uniswap/white" alt="Uniswap" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/chainlink/white" alt="Chainlink" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/github/white" alt="GitHub" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/rust/white" alt="Rust" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/solidity/white" alt="Solidity" style={{ height: 24 }} />
              <img src="https://cdn.simpleicons.org/polygon/white" alt="Polygon" style={{ height: 24 }} />
            </div>
            <div className="ns-logos-fade left"></div>
            <div className="ns-logos-fade right"></div>
          </div>
        </div>
      </section>

      <section className="landing-hero">
        <span className="landing-eyebrow">
          <span className="pill">live</span>
          Verified protocols only · waitlist open
        </span>
        <h1>
          Smart contracts pass the unit tests.<br />
          Then they <em>crash-test</em> the economy.
        </h1>
        <p className="landing-sub">
          The first CI/CD platform that verifies the economics of your smart contracts —
          not just the code. Math layer, game-theory layer, one continuous loop.
        </p>
        <div className="landing-cta">
          <button className="btn btn-primary" style={{ padding: "10px 18px", fontSize: 13.5 }} onClick={() => alert("Request access is not connected in this local demo.")}>
            Request access <IconArrow size={12} />
          </button>
          <button className="btn" style={{ padding: "10px 16px", fontSize: 13.5 }} onClick={() => onNavigate("dashboard")}>
            Open the demo
          </button>
        </div>

        <div className="stat-strip">
          <div className="stat">
            <div className="v"><em>$10B</em></div>
            <div className="k">lost to economic exploits · 2021–2025</div>
            <div className="d">Drained from protocols whose code passed audit but whose mechanism design did not. Gandy catches both.</div>
          </div>
          <div className="stat">
            <div className="v">11</div>
            <div className="k">analytical frameworks</div>
            <div className="d">Algebraic, differential, stochastic — and four game-theoretic layers running on every PR.</div>
          </div>
          <div className="stat">
            <div className="v">100k</div>
            <div className="k">Monte Carlo scenarios per run</div>
            <div className="d">Ruin probability evaluated at the 1st percentile under tail conditions. Configurable.</div>
          </div>
        </div>
      </section>

      <section className="pricing-wrap">
        <div className="pricing-head">
          <h2>Three tiers. No free trial.</h2>
          <p>Gandy runs on every PR. Pricing scales with the value you're protecting, not seat count.</p>
        </div>
        <div className="pricing-grid">
          <div className="tier">
            <div className="tier-name">Builder</div>
            <div className="tier-price">$2,400<small> / mo</small></div>
            <div className="tier-desc">One protocol. Math + Nash equilibrium. Reports as PDF.</div>
            <ul className="tier-list">
              <li><IconCheck size={11} /><span>1 repository · unlimited PRs</span></li>
              <li><IconCheck size={11} /><span>3 math frameworks</span></li>
              <li><IconCheck size={11} /><span>Nash equilibrium analysis</span></li>
              <li><IconCheck size={11} /><span>Slack & email notifications</span></li>
            </ul>
            <button className="btn" onClick={() => alert("Request access is not connected in this local demo.")}>Request access</button>
          </div>

          <div className="tier featured">
            <span className="tier-badge">Most chosen</span>
            <div className="tier-name">Protocol</div>
            <div className="tier-price">$9,800<small> / mo</small></div>
            <div className="tier-desc">Up to 5 repositories. Full math + game-theory loop. API access. Bob session logs.</div>
            <ul className="tier-list">
              <li><IconCheck size={11} /><span>5 repositories</span></li>
              <li><IconCheck size={11} /><span>All 11 analytical frameworks</span></li>
              <li><IconCheck size={11} /><span>Auto-patch generation</span></li>
              <li><IconCheck size={11} /><span>Custom risk thresholds</span></li>
              <li><IconCheck size={11} /><span>API + webhook integrations</span></li>
              <li><IconCheck size={11} /><span>PagerDuty + Jira</span></li>
            </ul>
            <button className="btn btn-primary" onClick={() => alert("Request access is not connected in this local demo.")}>Request access</button>
          </div>

          <div className="tier">
            <div className="tier-name">Institutional</div>
            <div className="tier-price">Custom</div>
            <div className="tier-desc">For funds, exchanges, and protocols managing &gt; $500M TVL. White-glove onboarding.</div>
            <ul className="tier-list">
              <li><IconCheck size={11} /><span>Unlimited repositories</span></li>
              <li><IconCheck size={11} /><span>Custom verification profiles</span></li>
              <li><IconCheck size={11} /><span>Signed reports for risk committee</span></li>
              <li><IconCheck size={11} /><span>Bulk audit-archive export</span></li>
              <li><IconCheck size={11} /><span>Granular role-based access</span></li>
              <li><IconCheck size={11} /><span>24/7 on-call from Gandy team</span></li>
            </ul>
            <button className="btn" onClick={() => alert("Contact form is not connected in this local demo.")}>Talk to us</button>
          </div>
        </div>
      </section>

      <footer style={{ padding: "60px 28px 40px", borderTop: "1px solid var(--hairline)", color: "var(--text-mute)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="logo-mark" style={{ width: 14, height: 14, fontSize: 9 }}>G</span>
            gandy · economic verification, continuous
          </span>
          <span>© 2026</span>
        </div>
      </footer>
    </main>
  );
}

function LandingShell({ onNavigate }) {
  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <header className="topbar" style={{ position: "sticky", top: 0 }}>
        <div className="topbar-left">
          <button className="logo" onClick={() => onNavigate("dashboard")}>
            <span className="logo-mark">G</span>
            <span>gandy</span>
          </button>
          <nav className="topbar-nav" style={{ marginLeft: 28 }}>
            <a onClick={() => alert("This is a single-page local demo.")}>How it works</a>
            <a onClick={() => alert("Pricing is shown on this page.")}>Pricing</a>
            <a onClick={() => alert("Docs are not connected in this local demo.")}>Docs</a>
          </nav>
        </div>
        <div className="topbar-right" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("dashboard")}>Login</button>
          <button className="btn btn-primary btn-sm" onClick={() => alert("Request access is not connected in this local demo.")}>Request access</button>
        </div>
      </header>
      <LandingScreen onNavigate={onNavigate} />
    </div>
  );
}

Object.assign(window, { LandingScreen, LandingShell });
