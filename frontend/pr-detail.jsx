/* global React, Pipeline, ContextPanel, DiffPanel, useApp */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// initial states helper
const initMath = () => MATH_FW.map(() => ({ status: "pending", progress: 0 }));
const initGame = () => GAME_FW.map(() => ({ status: "pending" }));

function usePipelineEngine(initialStatus, opts = {}) {
  // status: idle | running | failed | passed
  const startsPassed = initialStatus === "passed";
  const [run, setRun] = useState({ status: initialStatus || "idle", stage: startsPassed ? 4 : 0, mode: "first" });
  const [math, setMath] = useState(startsPassed ? MATH_FW.map(() => ({ status: "done", progress: 100 })) : initMath());
  const [game, setGame] = useState(startsPassed ? GAME_FW.map(() => ({ status: "done" })) : initGame());
  const [spec, setSpec] = useState(0);
  const [read, setRead] = useState(0);
  const [bob, setBob] = useState([]);
  const [iter, setIter] = useState(startsPassed ? 1 : 0);
  const profile = opts.profile || "vortex";
  const copy = getDemoProfile(profile);

  const timers = useRef([]);
  const tStartRef = useRef(0);
  const log = useCallback((m) => {
    setBob(b => [...b, { t: fmtTime(Date.now() - tStartRef.current), m }]);
  }, []);
  const sched = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const reset = useCallback(() => {
    clear();
    setMath(initMath());
    setGame(initGame());
    setSpec(0);
    setRead(0);
    setRun({ status: "idle", stage: 0, mode: "first" });
  }, []);

  const beginRun = useCallback((mode = "first") => {
    clear();
    tStartRef.current = Date.now();
    setBob([]);
    setMath(initMath());
    setGame(initGame());
    setSpec(0);
    setRead(0);
    setRun({ status: "running", stage: 0, mode });
    setIter(i => i + 1);

    if (mode === "first") {
      log(`<span class="tag">session 9f3e</span> ${copy.session}`);
      log(`<span class="tag">stage 1</span> ${copy.read}`);
    } else {
      log(`<span class="tag">session 9f3e</span> ${profile === "voteWeight" ? `${copy.rerunLog} ${iter + 1}` : copy.rerunLog}`);
      log(`<span class="tag">stage 3</span> jumping to math layer (skip read/spec)`);
    }

    let cursor = 0;

    if (mode === "first") {
      // STAGE 1 — reading files
      let f = 0;
      const filePush = () => {
        if (f < 7) {
          setRead(++f);
          sched(filePush, 250);
        }
      };
      sched(filePush, 200);
      sched(() => log(`<span class="ok">✓</span> ${copy.graphLog}`), 1400);
      cursor += STAGES[0].duration;

      // STAGE 2 — spec generation
      sched(() => {
        setRun(r => ({ ...r, stage: 1 }));
        log(`<span class="tag">stage 2</span> generating Z3 constraints…`);
        let p = 0;
        const tick = () => {
          p += 7 + Math.random() * 8;
          if (p > 100) p = 100;
          setSpec(Math.round(p));
          if (p < 100) sched(tick, 120);
        };
        tick();
        sched(() => log(`<span class="ok">✓</span> ${copy.specLog}`), 2200);
      }, cursor);
      cursor += STAGES[1].duration;
    }

    // STAGE 3 — math layer
    sched(() => {
      setRun(r => ({ ...r, stage: 2 }));
      log(`<span class="tag">stage 3</span> math layer · executing 3 frameworks`);
      let off = 0;
      MATH_FW.forEach((fw, i) => {
        sched(() => {
          setMath(m => m.map((s, idx) => idx === i ? { ...s, status: "run", progress: 0 } : s));
          log(`<span class="tag">math/${fw.name.toLowerCase()}</span> running…`);
          if (fw.name === "Stochastic") {
            let p = 0;
            const tick = () => {
              p += 5 + Math.random() * 8;
              if (p > 100) p = 100;
              setMath(m => m.map((s, idx) => idx === i ? { ...s, progress: Math.round(p) } : s));
              if (p < 100) sched(tick, 100);
            };
            tick();
          }
        }, off);
        off += fw.ms;
        sched(() => {
          setMath(m => m.map((s, idx) => idx === i ? { status: "done", progress: 100 } : s));
          log(`<span class="ok">✓</span> ${fw.name} satisfied`);
        }, off - 50);
      });
    }, cursor);
    cursor += STAGES[2].duration;

    // STAGE 4 — game theory
    sched(() => {
      setRun(r => ({ ...r, stage: 3 }));
      log(`<span class="tag">stage 4</span> game-theory layer · 3 frameworks`);
      let off = 0;
      GAME_FW.forEach((fw, i) => {
        sched(() => {
          setGame(g => g.map((s, idx) => idx === i ? { status: "run" } : s));
          log(`<span class="tag">game/${fw.name.split(" ")[0].toLowerCase()}</span> running…`);
        }, off);
        off += fw.ms;
        sched(() => {
          // On the FIRST run, mechanism design (index 1) fails. On re-run, all pass.
          const willFail = (mode === "first" && i === 1);
          if (willFail) {
            setGame(g => g.map((s, idx) => idx === i ? { status: "fail" } : s));
            log(`<span class="err">✗ ${fw.name} VIOLATED</span> · dominant strategy detected`);
          } else {
            setGame(g => g.map((s, idx) => idx === i ? { status: "done" } : s));
            log(`<span class="ok">✓</span> ${fw.name} satisfied`);
          }
        }, off - 50);
      });
    }, cursor);
    cursor += STAGES[3].duration;

    // STAGE 5 — verdict
    sched(() => {
      setRun(r => ({ ...r, stage: 4 }));
      if (mode === "first") {
        log(`<span class="err">${copy.failLog}</span>`);
        log(`<span class="tag">bob</span> generating patch proposal…`);
        sched(() => {
          setRun(r => ({ ...r, status: "failed" }));
          log(`<span class="warn">patch ready</span> · waiting on human review`);
        }, 400);
      } else {
        log(`<span class="ok">verdict: PASSED</span> · no dominant strategy in tested range`);
        log(`<span class="tag">report</span> 11 frameworks · 100k MC runs · signed & ready`);
        sched(() => {
          setRun(r => ({ ...r, status: "passed" }));
        }, 400);
      }
    }, cursor);
  }, [iter, log, profile]);

  useEffect(() => clear, []);

  return { run, math, game, spec, read, bob, iter, beginRun, reset };
}

function PRDetailScreen({ onNavigate, forcedStatus, prId }) {
  const { state } = useApp();
  const prNumber = Number(prId) || 1;
  const pr = useMemo(() => {
    const prs = state.pullRequests || [];
    return prs.find((p) => Number(p.number) === prNumber) || prs[0];
  }, [state.pullRequests, prNumber]);
  const repo = useMemo(() => {
    const repos = state.repositories || [];
    return repos.find((r) => r.id === pr?.repoId) || repos.find((r) => r.name === pr?.repo);
  }, [state.repositories, pr]);
  const repoName = repo ? `${repo.org}/${repo.name}` : "vortex-amm";
  const branch = repo?.branch || "master";
  const profile = pr?.demoProfile || (prNumber === 1 ? "beanstalk" : "voteWeight");
  const engine = usePipelineEngine(pr?.verified ? "passed" : "idle", { profile });

  // Tweak: force a status. When tweak changes, snap to it.
  useEffect(() => {
    if (!forcedStatus) return;
    engine.reset();
    if (forcedStatus === "running") {
      setTimeout(() => engine.beginRun("first"), 60);
    } else if (forcedStatus === "failed") {
      // simulate ending state directly
      setTimeout(() => {
        // jump straight to failed by running and skipping animation? simplest: run with very short delays
        // We'll just call beginRun and rely on the timeline; for a snap, set state directly:
        snapTo(engine, "failed");
      }, 60);
    } else if (forcedStatus === "passed") {
      setTimeout(() => snapTo(engine, "passed"), 60);
    }
    // idle = reset already done
  }, [forcedStatus]);

  const onAccept = () => {
    engine.beginRun("rerun");
  };

  const headerStatus = engine.run.status;

  return (
    <main className="content">
      <div className="detail-head">
        <div>
          <div className="crumbs">
            <span onClick={() => onNavigate("dashboard")} style={{ cursor: "pointer" }}>{repoName}</span>
            <IconChevRight size={10} />
            <span>pull requests</span>
            <IconChevRight size={10} />
            <span style={{ color: "var(--text)" }}>#{pr?.number || prNumber}</span>
          </div>
          <h1>{pr?.title || "GovernanceFacet · Flash Loan Vulnerability"}</h1>
          <div className="meta">
            <span><IconBranch /></span>
            <span>{pr?.branch || branch} → {branch}</span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span>@{pr?.author || "attacker"}</span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span>{pr?.date || "2022-04-17"}</span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span>{(pr?.files && pr.files.length) ? `${pr.files.length} file` : "1 file"}</span>
          </div>
        </div>
        <div className="actions">
          <span className={`status ${
            headerStatus === "running" ? "run" :
            headerStatus === "failed" ? "fail" :
            headerStatus === "passed" ? "pass" : ""
          }`}>
            <span className="dot" />
            {headerStatus === "idle" ? "Not verified" :
             headerStatus === "running" ? `Verifying · stage ${engine.run.stage + 1} of 5` :
             headerStatus === "failed" ? "Failed verification" :
             "Passed · ready to merge"}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (repo?.url && repo.url.startsWith("http")) {
                window.open(repo.url, "_blank", "noopener,noreferrer");
              }
            }}
            disabled={!repo?.url || !repo.url.startsWith("http")}
          >
            <IconExt /> Open on GitHub
          </button>
          {headerStatus === "idle" && (
            <button className="btn btn-primary btn-sm" onClick={() => engine.beginRun("first")}>
              <IconPlay /> Verify now
            </button>
          )}
          {(headerStatus === "failed" || headerStatus === "passed") && (
            <button className="btn btn-sm" onClick={() => engine.beginRun("first")}>
              <IconArrow /> Re-verify
            </button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <ContextPanel
          profile={profile}
          readingFiles={engine.run.status === "running" && engine.run.stage === 0 ? engine.read : null}
        />
        <DiffPanel profile={profile} />
        <Pipeline
          profile={profile}
          runState={engine.run}
          mathState={engine.math}
          gameState={engine.game}
          specProgress={engine.spec}
          readProgress={engine.read}
          iterations={engine.iter}
          bobLog={engine.bob}
          onAccept={onAccept}
          onVerify={() => engine.beginRun("first")}
        />
      </div>
    </main>
  );
}

// Snap helpers (for tweaks)
function snapTo(engine, target) {
  // We'll use a hacky approach: reset, then sequentially fast-forward.
  engine.reset();
  // Use private state via beginRun isn't ideal; instead, we'll dispatch a custom event handled inside the hook.
  // For simplicity, just call beginRun, then rely on speed. But that's slow.
  // We bypass by mutating in microtask:
  // Not perfect but the user will toggle and see the result animate.
  if (target === "failed") engine.beginRun("first");
  if (target === "passed") {
    engine.beginRun("first");
    // After ~12s the system would be in failed; we want passed. Trigger rerun in chain.
    // Simpler: emit a synthetic acceptance after the cycle.
    setTimeout(() => engine.beginRun("rerun"), 13000);
  }
}

Object.assign(window, { PRDetailScreen });
