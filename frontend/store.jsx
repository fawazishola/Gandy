/* global React */
const { createContext, useContext, useState, useEffect } = React;

const SEEDED_REPOSITORIES = [
  {
    id: 1,
    name: "Beanstalk",
    org: "BeanstalkFarms",
    type: "Governance",
    status: "connected",
    health: 45,
    lastVerified: "Never",
    prs: 1,
    frameworks: 11,
    branch: "master",
    url: "https://github.com/BeanstalkFarms/Beanstalk",
    description: "Beanstalk protocol (pre-exploit governance)"
  }
];

const SEEDED_PULL_REQUESTS = [
  {
    id: "beanstalk-pr-1",
    number: 1,
    title: "GovernanceFacet - Flash Loan Vulnerability",
    repo: "Beanstalk",
    repoId: 1,
    author: "attacker",
    date: "2022-04-17",
    status: "open",
    description: "Pre-exploit governance contract with flash loan vulnerability",
    files: ["protocol/contracts/farm/facets/GovernanceFacet.sol"],
    demoProfile: "beanstalk",
    verified: false
  },
  {
    id: "vortex-pr-47",
    number: 47,
    title: "Refactor governance vote weight calculation",
    repo: "vortex-amm",
    repoId: 2,
    author: "jules",
    date: "2026-05-16",
    branch: "feat/gov-vote-weight",
    status: "open",
    description: "Changes vote-weight calculation and reward boost behavior",
    files: ["contracts/Governor.sol"],
    demoProfile: "voteWeight",
    verified: false
  },
  {
    id: "vortex-pr-46",
    number: 46,
    title: "Bump curve invariant precision",
    repo: "vortex-amm",
    repoId: 2,
    author: "hannah",
    date: "2026-05-15",
    branch: "fix/curve-precision",
    status: "open",
    description: "Raises invariant math precision in stable swap curve calculations",
    files: ["contracts/lib/CurveMath.sol"],
    demoProfile: "precision",
    verified: true
  },
  {
    id: "vortex-pr-45",
    number: 45,
    title: "Add liquidity migration helper",
    repo: "vortex-amm",
    repoId: 2,
    author: "drew",
    date: "2026-05-14",
    branch: "feat/liquidity-migration",
    status: "open",
    description: "Adds a helper to migrate LP positions between router versions",
    files: ["contracts/RouterV2.sol"],
    demoProfile: "migration",
    verified: true
  },
  {
    id: "vortex-pr-44",
    number: 44,
    title: "Tighten oracle TWAP window",
    repo: "vortex-amm",
    repoId: 2,
    author: "priya",
    date: "2026-05-13",
    branch: "fix/oracle-twap-window",
    status: "open",
    description: "Narrows the oracle averaging window used for swap bounds",
    files: ["contracts/oracle/TwapOracle.sol"],
    demoProfile: "oracle",
    verified: true
  }
];

const SEEDED_REPORTS = [
  {
    id: "VER-2026-BE01",
    pr: 1,
    title: "GovernanceFacet - Flash Loan Vulnerability",
    repo: "Beanstalk",
    date: "2026-05-16",
    time: "4:58 PM",
    status: "failed",
    iteration: 1,
    frameworks: { math: 3, game: 3 },
    duration: "9s",
    failReason: "Flash-loan governance takeover: current-block voting power can execute a malicious diamond cut"
  }
];

function migrateState(sourceState) {
  // v1 → v2: remove the temp_beanstalk local repo (duplicate)
  const repositories = Array.isArray(sourceState.repositories)
    ? sourceState.repositories.filter((r) => !(r && r.name === "temp_beanstalk" && r.org === "local"))
    : sourceState.repositories;
  if (repositories.length === (sourceState.repositories || []).length) return sourceState;
  return { ...sourceState, repositories };
}

function ensureSeedData(sourceState) {
  const repositories = Array.isArray(sourceState.repositories) ? sourceState.repositories : [];
  const pullRequests = Array.isArray(sourceState.pullRequests) ? sourceState.pullRequests : [];
  const reports = Array.isArray(sourceState.reports) ? sourceState.reports : [];
  const enrichedPullRequests = pullRequests.map((pr) => {
    const seed = SEEDED_PULL_REQUESTS.find((item) => (
      pr && Number(pr.number) === item.number && pr.repo === item.repo
    ));
    if (!seed) return pr;
    return {
      ...seed,
      ...pr,
      branch: pr.branch || seed.branch,
      description: pr.description || seed.description,
      files: Array.isArray(pr.files) && pr.files.length ? pr.files : seed.files,
      demoProfile: pr.demoProfile || seed.demoProfile
    };
  });

  const missingRepos = SEEDED_REPOSITORIES.filter((seed) => (
    !repositories.some((repo) => repo && repo.org === seed.org && repo.name === seed.name)
  ));

  const missingPrs = SEEDED_PULL_REQUESTS.filter((seed) => (
    !enrichedPullRequests.some((pr) => pr && Number(pr.number) === seed.number && pr.repo === seed.repo)
  ));
  const missingReports = SEEDED_REPORTS.filter((seed) => (
    !reports.some((report) => report && report.id === seed.id)
  ));

  const prsChanged = enrichedPullRequests.some((pr, i) => pr !== pullRequests[i]);

  if (!missingRepos.length && !missingPrs.length && !missingReports.length && !prsChanged) return sourceState;

  return {
    ...sourceState,
    repositories: [...missingRepos, ...repositories],
    pullRequests: [...missingPrs, ...enrichedPullRequests],
    reports: [...missingReports, ...reports]
  };
}

// Initial state
const initialState = {
  repositories: [
    ...SEEDED_REPOSITORIES,
    {
      id: 2,
      name: "vortex-amm",
      org: "vortex-protocol",
      type: "AMM",
      status: "connected",
      health: 92,
      lastVerified: "2 hours ago",
      prs: 47,
      frameworks: 11,
      branch: "main"
    },
    {
      id: 3,
      name: "lending-core",
      org: "vortex-protocol",
      type: "Lending",
      status: "connected",
      health: 88,
      lastVerified: "5 hours ago",
      prs: 23,
      frameworks: 11,
      branch: "main"
    },
    {
      id: 4,
      name: "governance-v2",
      org: "vortex-protocol",
      type: "Governance",
      status: "paused",
      health: 76,
      lastVerified: "3 days ago",
      prs: 12,
      frameworks: 8,
      branch: "develop"
    }
  ],
  pullRequests: [
    ...SEEDED_PULL_REQUESTS
  ],
  reports: [
    ...SEEDED_REPORTS,
    {
      id: "VER-2026-0147",
      pr: 47,
      title: "feat: Add vote-weight boost mechanism",
      repo: "vortex-amm",
      date: "2026-05-15",
      time: "11:23 AM",
      status: "passed",
      iteration: 2,
      frameworks: { math: 3, game: 4 },
      duration: "4m 32s"
    },
    {
      id: "VER-2026-0146",
      pr: 46,
      title: "fix: Update liquidity pool fee calculation",
      repo: "vortex-amm",
      date: "2026-05-14",
      time: "3:45 PM",
      status: "passed",
      iteration: 1,
      frameworks: { math: 3, game: 3 },
      duration: "3m 18s"
    },
    {
      id: "VER-2026-0145",
      pr: 45,
      title: "feat: Implement flash loan protection",
      repo: "vortex-amm",
      date: "2026-05-14",
      time: "10:12 AM",
      status: "failed",
      iteration: 1,
      frameworks: { math: 3, game: 4 },
      duration: "4m 05s",
      failReason: "Nash equilibrium: Dominant exploit strategy detected"
    },
    {
      id: "VER-2026-0144",
      pr: 23,
      title: "feat: Add collateral ratio adjustment",
      repo: "lending-core",
      date: "2026-05-13",
      time: "2:30 PM",
      status: "passed",
      iteration: 3,
      frameworks: { math: 3, game: 4 },
      duration: "5m 47s"
    },
    {
      id: "VER-2026-0143",
      pr: 22,
      title: "fix: Interest rate calculation edge case",
      repo: "lending-core",
      date: "2026-05-13",
      time: "9:15 AM",
      status: "passed",
      iteration: 1,
      frameworks: { math: 3, game: 2 },
      duration: "2m 54s"
    }
  ],
  teamMembers: [
    {
      id: 1,
      email: "fawaz@vortex.io",
      name: "Fawaz",
      role: "Admin",
      added: "2026-01-15",
      avatar: "FA"
    },
    {
      id: 2,
      email: "john@vortex.io",
      name: "John",
      role: "Developer",
      added: "2026-02-03",
      avatar: "JD"
    }
  ],
  apiKeys: [
    {
      id: 1,
      key: "gnd_live_abc123...xyz789",
      created: "2026-03-10",
      lastUsed: "2 hours ago"
    }
  ],
  settings: {
    protocolType: "AMM",
    mathFrameworks: ["algebraic", "differential", "stochastic"],
    gameFrameworks: ["nash", "mechanism", "repeated", "evolutionary"],
    monteCarloIterations: 100000,
    githubIntegration: {
      blockMerge: true,
      autoComment: true,
      generatePatches: true
    },
    notifications: {
      slack: { failures: true, passes: true, daily: false },
      email: { failures: true, passes: false, weekly: true }
    }
  }
};

const AppContext = createContext();

function AppProvider({ children }) {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem('gandy-state');
    if (!saved) return initialState;

    try {
      return ensureSeedData(migrateState(JSON.parse(saved)));
    } catch (err) {
      console.warn("Failed to parse saved Gandy state; using defaults", err);
      return initialState;
    }
  });

  useEffect(() => {
    setState((s) => ensureSeedData(s));
  }, []);

  // Save to localStorage on state change
  useEffect(() => {
    localStorage.setItem('gandy-state', JSON.stringify(state));
  }, [state]);

  const actions = {
    // Repository actions
    addRepository: (repo) => {
      setState(s => ({
        ...s,
        repositories: [...s.repositories, { ...repo, id: Date.now() }]
      }));
    },
    
    removeRepository: (id) => {
      setState(s => ({
        ...s,
        repositories: s.repositories.filter(r => r.id !== id)
      }));
    },
    
    updateRepository: (id, updates) => {
      setState(s => ({
        ...s,
        repositories: s.repositories.map(r => r.id === id ? { ...r, ...updates } : r)
      }));
    },

    // Report actions
    addReport: (report) => {
      setState(s => ({
        ...s,
        reports: [{ ...report, id: `VER-2026-${String(s.reports.length + 100).padStart(4, '0')}` }, ...s.reports]
      }));
    },

    // Team member actions
    addTeamMember: (member) => {
      setState(s => ({
        ...s,
        teamMembers: [...s.teamMembers, { ...member, id: Date.now() }]
      }));
    },
    
    removeTeamMember: (id) => {
      setState(s => ({
        ...s,
        teamMembers: s.teamMembers.filter(m => m.id !== id)
      }));
    },
    
    updateTeamMember: (id, updates) => {
      setState(s => ({
        ...s,
        teamMembers: s.teamMembers.map(m => m.id === id ? { ...m, ...updates } : m)
      }));
    },

    // API key actions
    addApiKey: (key) => {
      setState(s => ({
        ...s,
        apiKeys: [...s.apiKeys, { ...key, id: Date.now() }]
      }));
    },
    
    removeApiKey: (id) => {
      setState(s => ({
        ...s,
        apiKeys: s.apiKeys.filter(k => k.id !== id)
      }));
    },

    // Settings actions
    updateSettings: (updates) => {
      setState(s => ({
        ...s,
        settings: { ...s.settings, ...updates }
      }));
    },

    // Reset to initial state
    resetState: () => {
      setState(initialState);
      localStorage.removeItem('gandy-state');
    }
  };

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}

function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

// Export to window
Object.assign(window, { AppProvider, useApp });

// Made with Bob
// Export to window for global access
Object.assign(window, { AppProvider, useApp });

// Made with Bob
