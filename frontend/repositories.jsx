/* global React, useApp, useToast, ConfirmDialog, FormModal, IconRepo, IconSettings, IconTrash, IconPlus */
const { useState, useEffect } = React;

function RepositoriesScreen({ onNavigate }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [newRepo, setNewRepo] = useState({ repoUrl: '', type: 'Governance', branch: '', githubToken: '' });
  const [verifyConfig, setVerifyConfig] = useState({ prNumber: '', targetFile: 'protocol/contracts/farm/facets/GovernanceFacet.sol', githubToken: '' });

  const repos = state.repositories || [];

  useEffect(() => {
    const hasBeanstalk = repos.some(
      (r) => r && r.org === "BeanstalkFarms" && r.name === "Beanstalk"
    );

    if (!hasBeanstalk) {
      actions.addRepository({
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
      });
    }
  }, [repos, actions]);

  const handleConnectRepo = async (e) => {
    e.preventDefault();
    if (!newRepo.repoUrl) {
      toast.error('Repository URL is required');
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/github/repo/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: newRepo.repoUrl,
          github_token: newRepo.githubToken || undefined
        })
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Failed to fetch repo');
      }

      const repoInfo = await res.json();

      actions.addRepository({
        name: repoInfo.repo,
        org: repoInfo.owner,
        type: newRepo.type,
        status: 'connected',
        health: 85,
        lastVerified: 'Just now',
        prs: 0,
        frameworks: 11,
        branch: newRepo.branch || repoInfo.default_branch,
        url: newRepo.repoUrl,
        githubToken: newRepo.githubToken || ''
      });

      toast.success(`Repository ${repoInfo.full_name} connected successfully`);
      setShowConnectModal(false);
      setNewRepo({ repoUrl: '', type: 'Governance', branch: '', githubToken: '' });
    } catch (err) {
      toast.error(`Connect failed: ${err.message || err}`);
    }
  };

  const handleDisconnect = () => {
    if (selectedRepo) {
      actions.removeRepository(selectedRepo.id);
      toast.success(`Repository ${selectedRepo.org}/${selectedRepo.name} disconnected`);
      setShowDisconnectConfirm(false);
      setSelectedRepo(null);
    }
  };

  const handleConfigure = (repo) => {
    setSelectedRepo(repo);
    setShowConfigModal(true);
  };

  const handleOpenVerify = (repo) => {
    if ((repo.name === "Beanstalk" || repo.name === "temp_beanstalk") && onNavigate) {
      onNavigate("pr", { pr: 1 });
      toast.info("Opened the Beanstalk PR. Click Verify now to run the exploit check.");
      return;
    }

    setSelectedRepo(repo);
    setVerifyConfig({
      prNumber: '',
      targetFile: 'protocol/contracts/farm/facets/GovernanceFacet.sol',
      githubToken: repo.githubToken || ''
    });
    setShowVerifyModal(true);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!selectedRepo || !verifyConfig.prNumber) {
      toast.error('PR number is required');
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pr_id: `${selectedRepo.org}/${selectedRepo.name}#${verifyConfig.prNumber}`,
          repository_url: selectedRepo.url || `https://github.com/${selectedRepo.org}/${selectedRepo.name}`,
          pr_number: Number(verifyConfig.prNumber),
          target_file: verifyConfig.targetFile || undefined,
          github_token: verifyConfig.githubToken || undefined
        })
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Failed to start verification');
      }

      const data = await res.json();
      toast.success(`Verification started: ${data.job_id}`);
      setShowVerifyModal(false);
      setSelectedRepo(null);
    } catch (err) {
      toast.error(`Verification failed: ${err.message || err}`);
    }
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    if (selectedRepo) {
      actions.updateRepository(selectedRepo.id, selectedRepo);
      toast.success('Repository configuration updated');
      setShowConfigModal(false);
      setSelectedRepo(null);
    }
  };

  return (
    <main className="content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Repositories</h1>
          <p className="page-sub">All connected repositories and their verification status</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowConnectModal(true)}>
          <IconPlus /> Connect repository
        </button>
      </div>

      <div className="stack">
        {repos.map((repo, i) => (
          <div key={i} className="card">
            <div className="card-head">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <IconRepo />
                <div>
                  <div className="card-title">
                    {repo.org}/{repo.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2 }}>
                    {repo.type} verification profile · {repo.branch} branch
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={`status ${repo.status === "connected" ? "pass" : "warn"}`}>
                  <span className="dot" />
                  {repo.status}
                </span>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                    Health Score
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 500, color: repo.health >= 85 ? "var(--pass)" : repo.health >= 70 ? "var(--warn)" : "var(--fail)" }}>
                    {repo.health}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                    Total PRs
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 500, color: "var(--text)" }}>
                    {repo.prs}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                    Frameworks
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 500, color: "var(--text)" }}>
                    {repo.frameworks}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mute)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                    Last Verified
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 8 }}>
                    {repo.lastVerified}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 8 }}>
                <button className="btn btn-sm" onClick={() => handleConfigure(repo)}>
                  <IconSettings /> Configure
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => handleOpenVerify(repo)}>
                  {repo.name === "Beanstalk" || repo.name === "temp_beanstalk" ? "Open Beanstalk PR" : "Trigger PR verify"}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => onNavigate ? onNavigate("reports") : toast.info("Reports page is available from the top navigation")}>
                  View reports
                </button>
                <button 
                  className="btn btn-sm btn-ghost" 
                  style={{ marginLeft: "auto" }}
                  onClick={() => {
                    setSelectedRepo(repo);
                    setShowDisconnectConfirm(true);
                  }}
                >
                  <IconTrash /> Disconnect
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Connect Repository Modal */}
      <FormModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onSubmit={handleConnectRepo}
        title="Connect Repository"
        submitText="Connect"
      >
        <div className="form-group">
          <label className="form-label">Repository URL *</label>
          <input
            type="text"
            className="form-input"
            value={newRepo.repoUrl}
            onChange={(e) => setNewRepo({ ...newRepo, repoUrl: e.target.value })}
            placeholder="https://github.com/BeanstalkFarms/Beanstalk"
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Protocol Type</label>
          <select
            className="form-select"
            value={newRepo.type}
            onChange={(e) => setNewRepo({ ...newRepo, type: e.target.value })}
          >
            <option value="AMM">AMM (Automated Market Maker)</option>
            <option value="Lending">Lending Protocol</option>
            <option value="Staking">Staking Protocol</option>
            <option value="Governance">Governance</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Branch</label>
          <input
            type="text"
            className="form-input"
            value={newRepo.branch}
            onChange={(e) => setNewRepo({ ...newRepo, branch: e.target.value })}
            placeholder="main"
          />
        </div>
        <div className="form-group">
          <label className="form-label">GitHub Token (optional)</label>
          <input
            type="password"
            className="form-input"
            value={newRepo.githubToken}
            onChange={(e) => setNewRepo({ ...newRepo, githubToken: e.target.value })}
            placeholder="ghp_..."
          />
          <div className="form-hint">Required for private repos or higher rate limits.</div>
        </div>
      </FormModal>

      {/* Configure Repository Modal */}
      {selectedRepo && (
        <FormModal
          isOpen={showConfigModal}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedRepo(null);
          }}
          onSubmit={handleSaveConfig}
          title={`Configure ${selectedRepo.org}/${selectedRepo.name}`}
          submitText="Save Changes"
        >
          <div className="form-group">
            <label className="form-label">Protocol Type</label>
            <select
              className="form-select"
              value={selectedRepo.type}
              onChange={(e) => setSelectedRepo({ ...selectedRepo, type: e.target.value })}
            >
              <option value="AMM">AMM (Automated Market Maker)</option>
              <option value="Lending">Lending Protocol</option>
              <option value="Staking">Staking Protocol</option>
              <option value="Governance">Governance</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Branch</label>
            <input
              type="text"
              className="form-input"
              value={selectedRepo.branch}
              onChange={(e) => setSelectedRepo({ ...selectedRepo, branch: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={selectedRepo.status}
              onChange={(e) => setSelectedRepo({ ...selectedRepo, status: e.target.value })}
            >
              <option value="connected">Connected</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </FormModal>
      )}

      {/* Trigger Verification Modal */}
      {selectedRepo && (
        <FormModal
          isOpen={showVerifyModal}
          onClose={() => {
            setShowVerifyModal(false);
            setSelectedRepo(null);
          }}
          onSubmit={handleVerify}
          title={`Trigger PR Verification · ${selectedRepo.org}/${selectedRepo.name}`}
          submitText="Start Verification"
        >
          <div className="form-group">
            <label className="form-label">PR Number *</label>
            <input
              type="number"
              className="form-input"
              value={verifyConfig.prNumber}
              onChange={(e) => setVerifyConfig({ ...verifyConfig, prNumber: e.target.value })}
              placeholder="1"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Target File (optional)</label>
            <input
              type="text"
              className="form-input"
              value={verifyConfig.targetFile}
              onChange={(e) => setVerifyConfig({ ...verifyConfig, targetFile: e.target.value })}
              placeholder="protocol/contracts/farm/facets/GovernanceFacet.sol"
            />
          </div>
          <div className="form-group">
            <label className="form-label">GitHub Token (optional)</label>
            <input
              type="password"
              className="form-input"
              value={verifyConfig.githubToken}
              onChange={(e) => setVerifyConfig({ ...verifyConfig, githubToken: e.target.value })}
              placeholder="ghp_..."
            />
          </div>
        </FormModal>
      )}

      {/* Disconnect Confirmation */}
      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        onClose={() => {
          setShowDisconnectConfirm(false);
          setSelectedRepo(null);
        }}
        onConfirm={handleDisconnect}
        title="Disconnect Repository?"
        message={selectedRepo ? `This will remove ${selectedRepo.org}/${selectedRepo.name} and all its verification history. This action cannot be undone.` : ''}
        confirmText="Disconnect"
        confirmStyle="danger"
      />
    </main>
  );
}

Object.assign(window, { RepositoriesScreen });

// Made with Bob
