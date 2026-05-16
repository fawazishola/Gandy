/* global React, useToast, exportToPDF */
const { useState, useEffect, useRef, useCallback } = React;

// ------- Pipeline stage definitions -------
const STAGES = [
  { id: 0, key: "read",    title: "Bob reading repository",     duration: 2200 },
  { id: 1, key: "spec",    title: "Specification generation",   duration: 2600 },
  { id: 2, key: "math",    title: "Math layer",                 duration: 3400 },
  { id: 3, key: "game",    title: "Game-theory layer",          duration: 3200 },
  { id: 4, key: "verdict", title: "Verdict",                    duration: 600  },
];

const MATH_FW = [
  { name: "Algebraic",   sub: "invariant constraints",   ms: 900 },
  { name: "Differential", sub: "boundary conditions",     ms: 900 },
  { name: "Stochastic",  sub: "Monte Carlo · 100k runs", ms: 1500 },
];
const GAME_FW = [
  { name: "Nash equilibrium",     sub: "best-response convergence", ms: 1000 },
  { name: "Mechanism design",     sub: "incentive compatibility",   ms: 1100 },
  { name: "Repeated games",       sub: "folk-theorem stability",    ms: 1100 },
];

// Time helper
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}.${String(ms % 1000).padStart(3,"0").slice(0,2)}`;
};

const DEMO_PROFILES = {
  beanstalk: {
    session: "initialized · local/temp_beanstalk @ detached HEAD",
    read: "reading Beanstalk governance contracts…",
    graphLog: "mapped governance graph · GovernanceFacet.emergencyCommit → DiamondCutFacet.diamondCut",
    specLog: "15 constraints emitted · flash-loan governance model defined",
    failLog: "verdict: FAILED · flash-loan governance takeover can drain protocol funds",
    rerunLog: "re-running with patch · snapshot delay restored",
    fileLabel: "protocol/contracts/farm/facets/GovernanceFacet.sol",
    lineCount: "238",
    files: [
      { p: "protocol/contracts/farm/facets/GovernanceFacet.sol", touched: true },
      { p: "protocol/contracts/farm/AppStorage.sol", touched: true },
      { p: "protocol/contracts/libraries/LibDiamond.sol", touched: true },
      { p: "protocol/contracts/farm/facets/SiloFacet/SiloFacet.sol", touched: false },
      { p: "bips/bip-18.md", touched: true },
      { p: "protocol/test/Governance.test.js", touched: false },
      { p: "protocol/scripts/diamond.js", touched: false },
    ],
    graph: <>Proposal execution can commit a diamond cut immediately after borrowed voting power is acquired. Affects <strong>protocol ownership</strong>, <strong>treasury movement</strong>, and <strong>emergency governance execution</strong> inside one transaction.</>,
    diff: [
      { hunk: "protocol/contracts/farm/facets/GovernanceFacet.sol  ·  @@ -204,7 +204,12 @@ function emergencyCommit()" },
      { type: "ctx", n: 204, c: "function emergencyCommit(uint32 bip) external payable {" },
      { type: "del", n: 205, c: "    require(_hasSeasonDelay(bip), \"Governance: delay not met\");" },
      { type: "del", n: 206, c: "    require(_snapshotVotingPower(msg.sender) >= emergencyThreshold(), \"Governance: insufficient votes\");" },
      { type: "add", n: 205, c: "    uint256 votes = bean.balanceOf(msg.sender);", flag: "flash-loan" },
      { type: "add", n: 206, c: "    require(votes >= emergencyThreshold(), \"Governance: insufficient votes\");", flag: "snapshot-bypass" },
      { type: "add", n: 207, c: "    // executes diamond cut with current-block voting power", flag: "treasury-risk" },
      { type: "add", n: 208, c: "    _executeDiamondCut(bip);", flag: "one-block" },
      { type: "ctx", n: 209, c: "}" },
    ],
    note: <>Bob flags this as a loss-of-funds path: current-block token balance is treated as governance power, so a flash loan can pass and execute a malicious diamond cut before anyone can react.</>,
    z3Label: "; — current-block governance power (PR #1) —"
  },
  voteWeight: {
    session: "initialized · vortex-amm @ feat/gov-vote-weight",
    read: "reading vote-weight and reward contracts…",
    graphLog: "mapped economic graph · Governor.voteWeight → RewardEmitter.boost",
    specLog: "14 constraints emitted · 3 game-theory players defined",
    failLog: "verdict: FAILED · flash-loan governance acquisition",
    rerunLog: "re-running with patch · iteration",
    fileLabel: "contracts/Governor.sol",
    lineCount: "142",
    files: [
      { p: "contracts/Governor.sol", touched: true },
      { p: "contracts/RewardEmitter.sol", touched: true },
      { p: "contracts/StakingVault.sol", touched: false },
      { p: "contracts/lib/Math.sol", touched: false },
      { p: "contracts/lib/Checkpoints.sol", touched: true },
      { p: "contracts/RouterV2.sol", touched: false },
      { p: "test/Governor.t.sol", touched: false },
    ],
    graph: <>Modifies <strong>Governor.voteWeight()</strong>, referenced by <strong>RewardEmitter.boost()</strong> and <strong>Checkpoints.lookup()</strong>. Affects <strong>total emission</strong> and <strong>governance threshold</strong>.</>,
    diff: [
      { hunk: "contracts/Governor.sol  ·  @@ -118,9 +118,16 @@ function voteWeight()" },
      { type: "ctx", n: 118, c: "function voteWeight(address account) public view returns (uint256) {" },
      { type: "del", n: 119, c: "    uint256 staked = stakingVault.balanceOf(account);" },
      { type: "del", n: 120, c: "    return staked;" },
      { type: "add", n: 119, c: "    uint256 staked = stakingVault.balanceOf(account);", flag: "checkpoint" },
      { type: "add", n: 120, c: "    uint256 boost = rewardEmitter.boostFactor(account);", flag: "loop-ref" },
      { type: "add", n: 121, c: "    // weight = (staked * boost) without delay window", flag: "incentive" },
      { type: "add", n: 122, c: "    return (staked * boost) / 1e18;" },
      { type: "ctx", n: 123, c: "}" },
    ],
    note: <>Three new lines change financially significant behavior. The removal of the checkpoint delay on <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>voteWeight</span> is the highest-risk edit.</>,
    z3Label: "; — vote-weight w/ no delay (PR #47) —"
  },
  precision: {
    session: "initialized · vortex-amm @ fix/curve-precision",
    read: "reading curve math and pool invariant tests…",
    graphLog: "mapped invariant graph · CurveMath.computeD → StablePool.swapOut",
    specLog: "12 constraints emitted · precision-loss bounds defined",
    failLog: "verdict: FAILED · rounding drift can misprice large swaps",
    rerunLog: "re-running with patch · fixed-point scale restored",
    fileLabel: "contracts/lib/CurveMath.sol",
    lineCount: "96",
    files: [
      { p: "contracts/lib/CurveMath.sol", touched: true },
      { p: "contracts/StablePool.sol", touched: true },
      { p: "contracts/lib/FixedPoint.sol", touched: true },
      { p: "test/CurveInvariant.t.sol", touched: true },
      { p: "contracts/RouterV2.sol", touched: false },
      { p: "contracts/oracle/TwapOracle.sol", touched: false },
      { p: "scripts/simulate-swaps.ts", touched: false },
    ],
    graph: <>Changes <strong>CurveMath.computeD()</strong>, which feeds swap quotes and withdrawal accounting. Small precision errors compound into <strong>pool imbalance</strong> during large trades.</>,
    diff: [
      { hunk: "contracts/lib/CurveMath.sol  ·  @@ -72,7 +72,11 @@ function computeD()" },
      { type: "ctx", n: 72, c: "function computeD(uint256[] memory balances) internal pure returns (uint256) {" },
      { type: "del", n: 73, c: "    uint256 precision = 1e18;" },
      { type: "add", n: 73, c: "    uint256 precision = 1e12;", flag: "precision-loss" },
      { type: "add", n: 74, c: "    uint256 d = _iterateD(balances, precision);", flag: "rounding" },
      { type: "add", n: 75, c: "    return d / precision;", flag: "quote-drift" },
      { type: "ctx", n: 76, c: "}" },
    ],
    note: <>Bob detects that lowering fixed-point precision makes the invariant cheaper to compute but unsafe for high-value swaps.</>,
    z3Label: "; — invariant precision loss (PR #46) —"
  },
  migration: {
    session: "initialized · vortex-amm @ feat/liquidity-migration",
    read: "reading router migration and allowance paths…",
    graphLog: "mapped migration graph · RouterV2.migrateLiquidity → LPToken.transferFrom",
    specLog: "10 constraints emitted · allowance and slippage checks defined",
    failLog: "verdict: FAILED · migration helper can move LP without fresh slippage bounds",
    rerunLog: "re-running with patch · slippage guard added",
    fileLabel: "contracts/RouterV2.sol",
    lineCount: "188",
    files: [
      { p: "contracts/RouterV2.sol", touched: true },
      { p: "contracts/LPToken.sol", touched: true },
      { p: "contracts/PoolsRegistry.sol", touched: true },
      { p: "test/Migration.t.sol", touched: true },
      { p: "contracts/lib/Math.sol", touched: false },
      { p: "contracts/oracle/TwapOracle.sol", touched: false },
      { p: "scripts/migrate-liquidity.ts", touched: false },
    ],
    graph: <>Adds <strong>RouterV2.migrateLiquidity()</strong>, touching user LP balances, allowances, and pool reserves. Missing fresh bounds can create a <strong>bad migration price</strong>.</>,
    diff: [
      { hunk: "contracts/RouterV2.sol  ·  @@ -201,6 +201,14 @@ function migrateLiquidity()" },
      { type: "ctx", n: 201, c: "function migrateLiquidity(address pool, uint256 shares) external {" },
      { type: "add", n: 202, c: "    lpToken.transferFrom(msg.sender, address(this), shares);", flag: "allowance" },
      { type: "add", n: 203, c: "    uint256 amountOut = oldPool.removeLiquidity(shares);", flag: "price-risk" },
      { type: "add", n: 204, c: "    newPool.addLiquidity(amountOut);", flag: "no-min-out" },
      { type: "add", n: 205, c: "    _mintReceipt(msg.sender, amountOut);", flag: "accounting" },
      { type: "ctx", n: 206, c: "}" },
    ],
    note: <>Bob finds the migration helper convenient but incomplete: no minimum output means users can migrate at a manipulated pool price.</>,
    z3Label: "; — migration slippage bound missing (PR #45) —"
  },
  oracle: {
    session: "initialized · vortex-amm @ fix/oracle-twap-window",
    read: "reading oracle window and swap guard code…",
    graphLog: "mapped oracle graph · TwapOracle.consult → RouterV2.maxSlippage",
    specLog: "9 constraints emitted · manipulation window defined",
    failLog: "verdict: FAILED · shortened TWAP can be manipulated inside one block cluster",
    rerunLog: "re-running with patch · minimum window enforced",
    fileLabel: "contracts/oracle/TwapOracle.sol",
    lineCount: "121",
    files: [
      { p: "contracts/oracle/TwapOracle.sol", touched: true },
      { p: "contracts/RouterV2.sol", touched: true },
      { p: "contracts/lib/OracleLib.sol", touched: true },
      { p: "test/TwapOracle.t.sol", touched: true },
      { p: "contracts/StablePool.sol", touched: false },
      { p: "contracts/lib/CurveMath.sol", touched: false },
      { p: "scripts/oracle-replay.ts", touched: false },
    ],
    graph: <>Narrows <strong>TwapOracle.consult()</strong>, which protects swaps from manipulated spot prices. Too short a window lets attackers push price and trade through stale-looking bounds.</>,
    diff: [
      { hunk: "contracts/oracle/TwapOracle.sol  ·  @@ -44,8 +44,10 @@ function consult()" },
      { type: "del", n: 44, c: "    uint32 window = 30 minutes;" },
      { type: "add", n: 44, c: "    uint32 window = 90 seconds;", flag: "short-window" },
      { type: "add", n: 45, c: "    uint256 price = pair.averagePrice(window);", flag: "manipulable" },
      { type: "add", n: 46, c: "    return _bound(price, maxDeviationBps);", flag: "swap-guard" },
      { type: "ctx", n: 47, c: "}" },
    ],
    note: <>Bob flags the tighter TWAP window as operationally faster but easier to manipulate during volatile liquidity conditions.</>,
    z3Label: "; — oracle manipulation window (PR #44) —"
  }
};

const getDemoProfile = (profile) => DEMO_PROFILES[profile] || DEMO_PROFILES.voteWeight;

// ------- Repo context panel -------
function ContextPanel({ readingFiles, activeFile, profile = "vortex" }) {
  const demo = getDemoProfile(profile);
  const files = demo.files;
  return (
    <aside className="card" style={{ position: "sticky", top: 64 }}>
      <div className="card-head">
        <div className="card-title">
          <IconRepo /> Repository context
        </div>
        <span className="card-sub">Bob</span>
      </div>
      <div className="context-list">
        {files.map((f, i) => {
          const isReading = readingFiles && i < readingFiles;
          const active = activeFile === f.p;
          return (
            <div key={f.p} className={`context-file ${f.touched ? "touched" : ""}`}
                 style={{
                   opacity: readingFiles == null || isReading ? 1 : 0.35,
                   transition: "opacity 0.2s",
                   outline: active ? "1px solid var(--accent-line)" : "none"
                 }}>
              <span className="ind" />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.p}</span>
              {f.touched && <span style={{ fontSize: 9.5, padding: "1px 5px", borderRadius: 3, background: "var(--accent-soft)", color: "var(--accent)", letterSpacing: "0.04em", textTransform: "uppercase" }}>read</span>}
            </div>
          );
        })}
      </div>
      <div className="context-rel">
        <div style={{ marginBottom: 8, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Economic graph</div>
        {demo.graph}
      </div>
    </aside>
  );
}

// ------- Diff panel (center) -------
function DiffPanel({ profile = "vortex" }) {
  const toast = useToast();
  const [viewMode, setViewMode] = useState('unified');
  const demo = getDemoProfile(profile);
  const diff = demo.diff;
  
  const handleViewChange = (mode) => {
    setViewMode(mode);
    toast.info(`Switched to ${mode} view`);
  };
  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title">
          <IconGit /> Changes
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)", marginLeft: 8 }}>
            1 file · <span className="add" style={{ color: "var(--pass)" }}>+4</span> <span className="del" style={{ color: "var(--fail)" }}>−2</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className={`btn btn-ghost btn-sm ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => handleViewChange('split')}
          >
            Split
          </button>
          <button
            className={`btn btn-ghost btn-sm ${viewMode === 'unified' ? 'active' : ''}`}
            onClick={() => handleViewChange('unified')}
          >
            Unified
          </button>
        </div>
      </div>
      <div className="diff-file-tab">
        <IconRepo />
        <span>{demo.fileLabel}</span>
        <span style={{ marginLeft: "auto", color: "var(--text-mute)" }}>Solidity · {demo.lineCount} lines</span>
      </div>
      <div className="diff">
        <div className="hunk-head">{diff[0].hunk}</div>
        {diff.slice(1).map((l, i) => (
          <div key={i} className={`diff-line ${l.type === "add" ? "add" : l.type === "del" ? "del" : ""} ${l.flag ? "flag" : ""}`}>
            <span className="gut">{l.type === "add" ? l.n : ""}</span>
            <span className="gut">{l.type === "del" ? l.n : (l.type === "ctx" ? l.n : "")}</span>
            <span className="code">{l.c}</span>
            {l.flag && <span className="diff-flag-margin" title={`Bob flagged: ${l.flag}`}>{l.flag}</span>}
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--hairline)", background: "var(--bg-elev)", fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.55 }}>
        <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", marginRight: 8 }}>Bob</span>
        {demo.note}
      </div>
    </section>
  );
}

// ------- Bob status thread -------
function BobThread({ lines }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);
  if (!lines.length) return null;
  return (
    <div className="bob-thread" ref={ref} style={{ maxHeight: 220, overflowY: "auto" }}>
      {lines.map((l, i) => (
        <div className="bob-line" key={i}>
          <span className="ts">{l.t}</span>
          <span className="msg" dangerouslySetInnerHTML={{ __html: l.m }} />
        </div>
      ))}
    </div>
  );
}

// ------- Verdict panel -------
function FailureVerdict({ onAccept, accepted }) {
  const toast = useToast();
  
  return (
    <>
      <div className="verdict fail">
        <div className="verdict-head">
          <IconX size={14} sw={2} /> Failed · Game theory · Mechanism design
        </div>
        <div className="verdict-grid">
          <span className="k">Dominant strategy</span>
          <span className="v">flash-loan governance acquisition</span>
          <span className="k">Player</span>
          <span className="v">any actor with ≥ $10M float capital</span>
          <span className="k">Payoff</span>
          <span className="v">guaranteed positive return under all tested market regimes</span>
          <span className="k">Incompatibility</span>
          <span className="v">one-shot extraction strictly dominates long-term alignment</span>
        </div>
        <div className="verdict-prose">
          A single transaction can borrow governance power, pass the proposal, execute the upgrade, and return
          the loan before aligned holders can respond. <strong>Bob</strong> found a closed-form exploit path with
          positive expected value across every tested capital regime.
        </div>
      </div>
      {!accepted && (
        <div className="patch">
          <div className="patch-head">
            <span className="label">Bob's proposed patch</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)" }}>
              re-introduce checkpoint window · 7,200 blocks
            </span>
          </div>
          <div className="diff">
            <div className="diff-line add">
              <span className="gut">119</span><span className="gut" /><span className="code">{`    uint256 staked = stakingVault.balanceOfAt(account, block.number - VOTE_DELAY);`}</span>
            </div>
            <div className="diff-line add">
              <span className="gut">120</span><span className="gut" /><span className="code">{`    uint256 boost = rewardEmitter.boostFactorAt(account, block.number - VOTE_DELAY);`}</span>
            </div>
            <div className="diff-line del">
              <span className="gut" /><span className="gut">119</span><span className="code">{`    uint256 staked = stakingVault.balanceOf(account);`}</span>
            </div>
            <div className="diff-line del">
              <span className="gut" /><span className="gut">120</span><span className="code">{`    uint256 boost = rewardEmitter.boostFactor(account);`}</span>
            </div>
          </div>
          <div className="patch-actions">
            <button className="btn btn-primary btn-sm" onClick={onAccept}>
              <IconCheck /> Accept &amp; re-verify
            </button>
            <button className="btn btn-sm" onClick={() => toast.info("Open PR #1 on GitHub to apply the patch — or use 'Accept & re-verify' to run the fixed version now.")}>Modify</button>
            <button className="btn btn-ghost btn-sm" onClick={() => toast.warning("Verification remains blocked until a safe patch is submitted.")}>Reject &amp; write my own</button>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)" }}>
              <span className="kbd">A</span> accept
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function generateVerificationReport() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gandy Verification Report — VER-2026-BE01</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #111; background: #fff; padding: 48px; line-height: 1.6; }
  h1 { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
  h2 { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; margin: 28px 0 10px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 3px; font-size: 11px; font-weight: bold; letter-spacing: 0.06em; }
  .fail { background: #fee2e2; color: #b91c1c; }
  .pass { background: #d1fae5; color: #065f46; }
  .meta { color: #555; font-size: 11px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td { padding: 6px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
  td:first-child { font-weight: bold; width: 200px; background: #f9fafb; }
  pre { background: #f4f4f4; border: 1px solid #ddd; padding: 12px; border-radius: 4px; font-size: 11px; overflow-x: auto; white-space: pre-wrap; margin-top: 8px; }
  .diff-del { color: #b91c1c; background: #fef2f2; display: block; padding: 0 4px; }
  .diff-add { color: #065f46; background: #f0fdf4; display: block; padding: 0 4px; }
  .diff-ctx { display: block; padding: 0 4px; }
  .fw-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
  .fw-ok { color: #065f46; font-weight: bold; }
  .fw-fail { color: #b91c1c; font-weight: bold; }
  footer { margin-top: 40px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
  <div>
    <h1>Gandy Verification Report</h1>
    <div class="meta">Report ID: VER-2026-BE01 &nbsp;·&nbsp; Generated: ${new Date().toLocaleString()} &nbsp;·&nbsp; Engine: v0.9.0-demo</div>
  </div>
  <span class="badge fail">FAILED</span>
</div>

<h2>Pull Request</h2>
<table>
  <tr><td>Repository</td><td>BeanstalkFarms/Beanstalk</td></tr>
  <tr><td>PR</td><td>#1 — GovernanceFacet - Flash Loan Vulnerability</td></tr>
  <tr><td>Author</td><td>@attacker</td></tr>
  <tr><td>Date</td><td>2022-04-17</td></tr>
  <tr><td>Branch</td><td>master → master</td></tr>
  <tr><td>Files changed</td><td>protocol/contracts/farm/facets/GovernanceFacet.sol</td></tr>
</table>

<h2>Diff Summary</h2>
<pre><span class="diff-ctx">@@ -204,7 +204,12 @@ function emergencyCommit() {</span><span class="diff-del">- require(_hasSeasonDelay(bip), "Governance: delay not met");</span><span class="diff-del">- require(_snapshotVotingPower(msg.sender) >= emergencyThreshold(), ...);</span><span class="diff-add">+ uint256 votes = bean.balanceOf(msg.sender);   // FLASH-LOAN</span><span class="diff-add">+ require(votes >= emergencyThreshold(), ...);   // SNAPSHOT-BYPASS</span><span class="diff-add">+ // executes diamond cut with current-block voting power  // TREASURY-RISK</span><span class="diff-add">+ _executeDiamondCut(bip);                        // ONE-BLOCK</span><span class="diff-ctx">}</span></pre>

<h2>Verification Pipeline</h2>
<div class="fw-row"><span>1 · Bob reading repository</span><span class="fw-ok">✓ 2.1s · 7 files</span></div>
<div class="fw-row"><span>2 · Specification generation</span><span class="fw-ok">✓ Z3 + game model · 15 constraints</span></div>
<div class="fw-row"><span>3 · Math layer — Algebraic</span><span class="fw-ok">✓ satisfied</span></div>
<div class="fw-row"><span>3 · Math layer — Differential</span><span class="fw-ok">✓ satisfied</span></div>
<div class="fw-row"><span>3 · Math layer — Stochastic (100k MC)</span><span class="fw-ok">✓ satisfied</span></div>
<div class="fw-row"><span>4 · Game theory — Nash equilibrium</span><span class="fw-ok">✓ satisfied</span></div>
<div class="fw-row"><span>4 · Game theory — Mechanism design</span><span class="fw-fail">✗ VIOLATED — dominant strategy detected</span></div>
<div class="fw-row"><span>4 · Game theory — Repeated games</span><span class="fw-ok">✓ satisfied</span></div>
<div class="fw-row"><span>5 · Verdict</span><span class="fw-fail">✗ FAILED</span></div>

<h2>Z3 Specification</h2>
<pre>; auto-generated by Bob · session 9f3e
(declare-const borrowed_votes Real)
(declare-const supply         Real)
(declare-const threshold      Real)
(declare-const treasury       Real)

; — invariants —
(assert (>= borrowed_votes 0))
(assert (>= supply 1.0))
(assert (= threshold (/ supply 2)))

; — current-block governance power (PR #1) —
(define-fun can_execute ((v Real)) Bool (>= v threshold))

; — exploit search: flash-stake-vote-unstake in one block —
(assert (can_execute borrowed_votes))
(assert (> treasury 0))
(check-sat)
; Result: SAT — exploit path exists</pre>

<h2>Game Theory Finding</h2>
<table>
  <tr><td>Dominant strategy</td><td>flash-loan governance acquisition</td></tr>
  <tr><td>Player</td><td>any actor with ≥ $10M float capital</td></tr>
  <tr><td>Payoff</td><td>guaranteed positive return under all tested market regimes</td></tr>
  <tr><td>Incompatibility</td><td>one-shot extraction strictly dominates long-term alignment</td></tr>
  <tr><td>Finding</td><td>A single transaction can borrow governance power, pass the proposal, execute the upgrade, and return the loan before aligned holders can respond. Bob found a closed-form exploit path with positive expected value across every tested capital regime.</td></tr>
</table>

<h2>Proposed Patch</h2>
<pre><span class="diff-add">+ uint256 staked = stakingVault.balanceOfAt(account, block.number - VOTE_DELAY);</span><span class="diff-add">+ uint256 boost = rewardEmitter.boostFactorAt(account, block.number - VOTE_DELAY);</span><span class="diff-del">- uint256 staked = stakingVault.balanceOf(account);</span><span class="diff-del">- uint256 boost = rewardEmitter.boostFactor(account);</span></pre>
<p style="margin-top:8px;font-size:11px;color:#555">Patch: re-introduce checkpoint window · 7,200 blocks. Acceptance of this patch and re-verification returned PASSED across all 6 frameworks.</p>

<footer>
  Gandy Neurosymbolic Verification Engine · Powered by IBM Watsonx · Z3 SMT Solver · Nashpy Game Theory<br>
  This report is generated for demonstration purposes. Report ID VER-2026-BE01 · ${new Date().toISOString()}
</footer>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

function PassVerdict({ iterations }) {
  const toast = useToast();

  return (
    <div className="verdict pass">
      <div className="verdict-head">
        <IconCheck size={14} sw={2} /> Passed · both layers
      </div>
      <div className="verdict-grid">
        <span className="k">Math layer</span>
        <span className="v">3 / 3 frameworks satisfied</span>
        <span className="k">Game theory</span>
        <span className="v">3 / 3 frameworks satisfied · no dominant strategy</span>
        <span className="k">Ruin probability</span>
        <span className="v">2.1e-7 &nbsp;·&nbsp; below tolerance (1e-5)</span>
        <span className="k">Loop iterations</span>
        <span className="v">{iterations}</span>
      </div>
      <div className="verdict-prose">
        Patch verified across all six analytical frameworks. No mechanism-design dominance found
        within the tested capital ranges. A signed verification report is ready for export.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={generateVerificationReport}><IconDownload /> Download report (PDF)</button>
        <button className="btn btn-sm" onClick={() => toast.success("Verification archive link copied to clipboard (demo).") }><IconExt /> Open in audit archive</button>
      </div>
    </div>
  );
}

// ------- Pipeline panel -------
function Pipeline({ runState, mathState, gameState, specProgress, readProgress, iterations, onAccept, onVerify, onReverify, bobLog, profile = "vortex" }) {
  const stageIdx = runState.stage;
  const isRunning = runState.status === "running";
  const failed = runState.status === "failed";
  const passed = runState.status === "passed";
  const idle = runState.status === "idle";
  const demo = getDemoProfile(profile);

  const stageClass = (i) => {
    if (failed && i === 4) return "fail";
    if (failed && i === 3 && runState.failedFw != null) return "fail";
    if (passed && i === 4) return "done";
    if (i < stageIdx) return "done";
    if (i === stageIdx && (isRunning || passed)) return isRunning ? "run" : "done";
    return "";
  };

  return (
    <section className="card pipeline">
      <div className="card-head">
        <div className="card-title">
          <IconShield /> Verification pipeline
        </div>
        <span className={`status ${idle ? "" : isRunning ? "run" : failed ? "fail" : "pass"}`}>
          <span className="dot" />
          {idle ? "Idle" : isRunning ? "Running" : failed ? "Failed" : "Passed"}
        </span>
      </div>

      {/* Stage 1: Read */}
      <div className={`pipe-stage ${stageClass(0)}`}>
        <div className="pipe-stage-head">
          <span className="pipe-num">{stageClass(0) === "done" ? <IconCheck size={10} sw={2.5} /> : "1"}</span>
          <span className="pipe-title">Bob reading repository</span>
          <span className="pipe-meta">{stageClass(0) === "done" ? "2.1s · 7 files" : stageClass(0) === "run" ? `${readProgress}/7 files` : "—"}</span>
        </div>
      </div>

      {/* Stage 2: Spec */}
      <div className={`pipe-stage ${stageClass(1)}`}>
        <div className="pipe-stage-head">
          <span className="pipe-num">{stageClass(1) === "done" ? <IconCheck size={10} sw={2.5} /> : "2"}</span>
          <span className="pipe-title">Specification generation</span>
          <span className="pipe-meta">{stageClass(1) === "done" ? "Z3 + game model" : stageClass(1) === "run" ? `${specProgress}%` : "—"}</span>
        </div>
        {(stageClass(1) === "run" || stageClass(1) === "done" || stageIdx > 1) && (
          <div className="pipe-body">
            <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 2 }}>
              Z3 — generated constraints
            </div>
            <div className="code-block">
{`; auto-generated by Bob · session 9f3e
(declare-const borrowed_votes Real)
(declare-const supply         Real)
(declare-const threshold      Real)
(declare-const treasury       Real)

`}<span className="cm">; — invariants —</span>{`
(assert (>= borrowed_votes 0))
(assert (>= supply 1.0))
(assert (= threshold (/ supply 2)))

`}<span className="cm">{demo.z3Label}</span>{`
(define-fun can_execute ((v Real)) Bool (>= v threshold))

`}<span className="cm">; — exploit search: flash-stake-vote-unstake in one block —</span>{`
(assert (can_execute borrowed_votes))
(assert (> treasury 0))
(check-sat)`}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 12 }}>
              Game model — players &amp; payoffs
            </div>
            <div className="code-block" style={{ maxHeight: 110 }}>
{`players : { LP, voter, flash_attacker }
strategies[flash_attacker] : { abstain, acquire }
payoff[acquire] = treasury_drain − gas − slippage`}<br/>{`payoff[abstain] = 0
horizon : one-shot (no repeated penalty)`}
            </div>
          </div>
        )}
      </div>

      {/* Stage 3: Math */}
      <div className={`pipe-stage ${stageClass(2)}`}>
        <div className="pipe-stage-head">
          <span className="pipe-num">{stageClass(2) === "done" ? <IconCheck size={10} sw={2.5} /> : "3"}</span>
          <span className="pipe-title">Math layer</span>
          <span className="pipe-meta">{stageClass(2) === "done" ? "3/3 passed" : stageClass(2) === "run" ? "running…" : "—"}</span>
        </div>
        {(stageClass(2) === "run" || stageClass(2) === "done" || stageIdx > 2) && (
          <div className="pipe-body">
            <div className="framework-list">
              {MATH_FW.map((fw, i) => {
                const st = mathState[i] || { status: "pending", progress: 0 };
                return (
                  <div key={fw.name} className={`fw-row ${st.status === "done" ? "done" : st.status === "run" ? "run" : ""}`}>
                    <span className="fw-name">
                      {fw.name}
                      <span style={{ color: "var(--text-faint)", marginLeft: 8 }}>· {fw.sub}</span>
                    </span>
                    {st.status === "run" && fw.name === "Stochastic" ? (
                      <span className="fw-progress"><span style={{ width: `${st.progress}%` }} /></span>
                    ) : <span />}
                    <span className="fw-status">
                      {st.status === "done" ? "satisfied" :
                       st.status === "run" ? "running" : "queued"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Stage 4: Game theory */}
      <div className={`pipe-stage ${stageClass(3)}`}>
        <div className="pipe-stage-head">
          <span className="pipe-num">
            {stageClass(3) === "done" ? <IconCheck size={10} sw={2.5} /> :
             stageClass(3) === "fail" ? <IconX size={10} sw={2.5} /> : "4"}
          </span>
          <span className="pipe-title">Game-theory layer</span>
          <span className="pipe-meta">
            {stageClass(3) === "done" ? "3/3 passed" :
             stageClass(3) === "fail" ? "1 framework failed" :
             stageClass(3) === "run" ? "running…" : "—"}
          </span>
        </div>
        {(stageClass(3) === "run" || stageClass(3) === "done" || stageClass(3) === "fail") && (
          <div className="pipe-body">
            <div className="framework-list">
              {GAME_FW.map((fw, i) => {
                const st = gameState[i] || { status: "pending" };
                return (
                  <div key={fw.name} className={`fw-row ${st.status === "done" ? "done" : st.status === "run" ? "run" : st.status === "fail" ? "fail" : ""}`}>
                    <span className="fw-name">
                      {fw.name}
                      <span style={{ color: "var(--text-faint)", marginLeft: 8 }}>· {fw.sub}</span>
                    </span>
                    <span />
                    <span className="fw-status">
                      {st.status === "done" ? "satisfied" :
                       st.status === "fail" ? "violated" :
                       st.status === "run" ? "running" : "queued"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Stage 5: Verdict */}
      <div className={`pipe-stage ${stageClass(4)}`}>
        <div className="pipe-stage-head">
          <span className="pipe-num">
            {failed ? <IconX size={10} sw={2.5} /> :
             passed ? <IconCheck size={10} sw={2.5} /> : "5"}
          </span>
          <span className="pipe-title">Verdict</span>
          <span className="pipe-meta">
            {failed ? "FAILED" : passed ? "PASSED" : "—"}
          </span>
        </div>
      </div>

      {/* Verdict content */}
      {failed && <FailureVerdict onAccept={onAccept} accepted={false} />}
      {passed && <PassVerdict iterations={iterations} />}

      {/* Idle CTA */}
      {idle && (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.55 }}>
            This pull request has not yet been verified.
            Running will execute six analytical frameworks across the math and game-theory layers.
          </div>
          <button className="btn btn-primary" onClick={onVerify}>
            <IconPlay /> Verify now
          </button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)", textAlign: "center" }}>
            estimated 9–13 seconds
          </span>
        </div>
      )}

      {/* Bob log */}
      <BobThread lines={bobLog} />
    </section>
  );
}

Object.assign(window, { Pipeline, ContextPanel, DiffPanel });
