/* global React, useApp, useToast, ConfirmDialog, FormModal, CopyButton, IconSettings, IconGitHub, IconBell, IconUsers, IconKey, IconCreditCard, IconPlus, IconTrash, IconCopy */
const { useState } = React;

function SettingsScreen() {
  const { state, actions } = useApp();
  const toast = useToast();
  
  // Local state for settings
  const [settings, setSettings] = useState(state.settings);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGenerateKeyModal, setShowGenerateKeyModal] = useState(false);
  const [showDeleteMemberConfirm, setShowDeleteMemberConfirm] = useState(false);
  const [showDeleteKeyConfirm, setShowDeleteKeyConfirm] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [newMember, setNewMember] = useState({ email: '', role: 'Developer' });
  const [newKey, setNewKey] = useState(null);

  const handleSaveSettings = () => {
    actions.updateSettings(settings);
    toast.success('Settings saved successfully');
  };

  const handleInviteMember = (e) => {
    e.preventDefault();
    if (!newMember.email) {
      toast.error('Please enter an email address');
      return;
    }

    const initials = newMember.email.split('@')[0].substring(0, 2).toUpperCase();
    actions.addTeamMember({
      ...newMember,
      name: newMember.email.split('@')[0],
      added: new Date().toISOString().split('T')[0],
      avatar: initials
    });

    toast.success(`Invitation sent to ${newMember.email}`);
    setShowInviteModal(false);
    setNewMember({ email: '', role: 'Developer' });
  };

  const handleDeleteMember = () => {
    if (selectedMember) {
      actions.removeTeamMember(selectedMember.id);
      toast.success(`${selectedMember.email} removed from team`);
      setShowDeleteMemberConfirm(false);
      setSelectedMember(null);
    }
  };

  const handleGenerateKey = () => {
    const key = `gnd_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const newKeyObj = {
      key: key,
      created: new Date().toISOString().split('T')[0],
      lastUsed: 'Never'
    };
    
    actions.addApiKey(newKeyObj);
    setNewKey(key);
    toast.success('API key generated successfully');
  };

  const handleDeleteKey = () => {
    if (selectedKey) {
      actions.removeApiKey(selectedKey.id);
      toast.success('API key deleted');
      setShowDeleteKeyConfirm(false);
      setSelectedKey(null);
    }
  };

  const handleCopyWebhook = () => {
    toast.success('Webhook URL copied to clipboard');
  };

  const handleCopyKey = () => {
    toast.success('API key copied to clipboard');
  };

  return (
    <main className="content">
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Configure verification profiles, integrations, and team access</p>

      <div className="stack">
        {/* Verification Profile */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <IconSettings /> Verification Profile
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Protocol Type</label>
                <select 
                  className="form-select" 
                  value={settings.protocolType}
                  onChange={(e) => setSettings({ ...settings, protocolType: e.target.value })}
                >
                  <option value="AMM">AMM (Automated Market Maker)</option>
                  <option value="Lending">Lending Protocol</option>
                  <option value="Staking">Staking Protocol</option>
                  <option value="Governance">Governance</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Math Frameworks</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {[
                    { id: 'algebraic', label: 'Algebraic constraints' },
                    { id: 'differential', label: 'Differential analysis' },
                    { id: 'stochastic', label: 'Stochastic simulation' },
                    { id: 'financial', label: 'Financial mathematics' }
                  ].map((fw) => (
                    <label key={fw.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={settings.mathFrameworks.includes(fw.id)}
                        onChange={(e) => {
                          const newFrameworks = e.target.checked
                            ? [...settings.mathFrameworks, fw.id]
                            : settings.mathFrameworks.filter(f => f !== fw.id);
                          setSettings({ ...settings, mathFrameworks: newFrameworks });
                        }}
                      />
                      {fw.label}
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Game Theory Frameworks</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {[
                    { id: 'nash', label: 'Nash equilibrium' },
                    { id: 'mechanism', label: 'Mechanism design' },
                    { id: 'repeated', label: 'Repeated games' },
                    { id: 'evolutionary', label: 'Evolutionary stability' }
                  ].map((fw) => (
                    <label key={fw.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={settings.gameFrameworks.includes(fw.id)}
                        onChange={(e) => {
                          const newFrameworks = e.target.checked
                            ? [...settings.gameFrameworks, fw.id]
                            : settings.gameFrameworks.filter(f => f !== fw.id);
                          setSettings({ ...settings, gameFrameworks: newFrameworks });
                        }}
                      />
                      {fw.label}
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Monte Carlo Iterations</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={settings.monteCarloIterations}
                  onChange={(e) => setSettings({ ...settings, monteCarloIterations: parseInt(e.target.value) })}
                  style={{ width: "200px" }} 
                />
                <div className="form-hint">
                  Higher values increase accuracy but take longer
                </div>
              </div>

              <div style={{ paddingTop: 16, borderTop: "1px solid var(--hairline)" }}>
                <button className="btn btn-primary" onClick={handleSaveSettings}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* GitHub Integration */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <IconGitHub /> GitHub Integration
            </div>
            <span className="status pass">
              <span className="dot" />
              connected
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={settings.githubIntegration.blockMerge}
                    onChange={(e) => setSettings({
                      ...settings,
                      githubIntegration: { ...settings.githubIntegration, blockMerge: e.target.checked }
                    })}
                  />
                  Block merge on verification failure
                </label>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={settings.githubIntegration.autoComment}
                    onChange={(e) => setSettings({
                      ...settings,
                      githubIntegration: { ...settings.githubIntegration, autoComment: e.target.checked }
                    })}
                  />
                  Auto-comment verification results on PRs
                </label>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={settings.githubIntegration.generatePatches}
                    onChange={(e) => setSettings({
                      ...settings,
                      githubIntegration: { ...settings.githubIntegration, generatePatches: e.target.checked }
                    })}
                  />
                  Generate Bob patch suggestions
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Webhook URL</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value="https://api.gandy.io/webhook/gh_abc123xyz" 
                    readOnly
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                  />
                  <CopyButton text="https://api.gandy.io/webhook/gh_abc123xyz" onCopy={handleCopyWebhook}>
                    Copy
                  </CopyButton>
                </div>
              </div>

              <div style={{ paddingTop: 16, borderTop: "1px solid var(--hairline)" }}>
                <button className="btn btn-primary" onClick={handleSaveSettings}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <IconBell /> Notifications
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12, color: "var(--text)" }}>
                  Slack
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={settings.notifications.slack.failures}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          slack: { ...settings.notifications.slack, failures: e.target.checked }
                        }
                      })}
                    />
                    Verification failures
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={settings.notifications.slack.passes}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          slack: { ...settings.notifications.slack, passes: e.target.checked }
                        }
                      })}
                    />
                    Verification passes
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={settings.notifications.slack.daily}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          slack: { ...settings.notifications.slack, daily: e.target.checked }
                        }
                      })}
                    />
                    Daily health reports
                  </label>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12, color: "var(--text)" }}>
                  Email
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={settings.notifications.email.failures}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          email: { ...settings.notifications.email, failures: e.target.checked }
                        }
                      })}
                    />
                    Verification failures
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={settings.notifications.email.passes}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          email: { ...settings.notifications.email, passes: e.target.checked }
                        }
                      })}
                    />
                    Verification passes
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={settings.notifications.email.weekly}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          email: { ...settings.notifications.email, weekly: e.target.checked }
                        }
                      })}
                    />
                    Weekly summary reports
                  </label>
                </div>
              </div>
            </div>

            <div style={{ paddingTop: 16, marginTop: 16, borderTop: "1px solid var(--hairline)" }}>
              <button className="btn btn-primary" onClick={handleSaveSettings}>
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* Team Access */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <IconUsers /> Team Access
            </div>
            <button className="btn btn-sm" onClick={() => setShowInviteModal(true)}>
              <IconPlus /> Invite member
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.teamMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="avatar">{member.avatar}</div>
                        <div>
                          <div style={{ color: "var(--text)", fontSize: 12.5 }}>{member.email}</div>
                          {member.role === 'Admin' && (
                            <div style={{ fontSize: 11, color: "var(--text-mute)" }}>Owner</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td><span className="mono">{member.role}</span></td>
                    <td><span className="mono">{member.added}</span></td>
                    <td>
                      {member.role !== 'Admin' && (
                        <button 
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setSelectedMember(member);
                            setShowDeleteMemberConfirm(true);
                          }}
                        >
                          <IconTrash />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* API Keys */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <IconKey /> API Keys
            </div>
            <button className="btn btn-sm" onClick={() => setShowGenerateKeyModal(true)}>
              <IconPlus /> Generate key
            </button>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {state.apiKeys.map((key) => (
                <div key={key.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-elev)", borderRadius: "var(--r-2)", border: "1px solid var(--hairline)" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text)" }}>
                      {key.key}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2 }}>
                      Created {key.created} · Last used {key.lastUsed}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <CopyButton text={key.key} onCopy={handleCopyKey} />
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setSelectedKey(key);
                        setShowDeleteKeyConfirm(true);
                      }}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <IconCreditCard /> Billing
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: "var(--text)" }}>
                  Current Plan
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: "var(--text)" }}>
                  Protocol
                </div>
                <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 4 }}>
                  $9,800 / month
                </div>
                <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => toast.info("Billing upgrades are not connected in this local demo.")}>
                  Upgrade to Institutional
                </button>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: "var(--text)" }}>
                  Usage This Month
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim)" }}>Compute hours</span>
                    <span className="mono" style={{ color: "var(--text)" }}>47 / 100</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim)" }}>Repositories</span>
                    <span className="mono" style={{ color: "var(--text)" }}>3 / 5</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim)" }}>Verifications</span>
                    <span className="mono" style={{ color: "var(--text)" }}>147</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      <FormModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSubmit={handleInviteMember}
        title="Invite Team Member"
        submitText="Send Invitation"
      >
        <div className="form-group">
          <label className="form-label">Email Address *</label>
          <input
            type="email"
            className="form-input"
            value={newMember.email}
            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
            placeholder="colleague@company.com"
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select
            className="form-select"
            value={newMember.role}
            onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
          >
            <option value="Developer">Developer</option>
            <option value="Admin">Admin</option>
            <option value="Viewer">Viewer</option>
          </select>
        </div>
      </FormModal>

      {/* Generate API Key Modal */}
      <Modal
        isOpen={showGenerateKeyModal}
        onClose={() => {
          setShowGenerateKeyModal(false);
          setNewKey(null);
        }}
        title="Generate API Key"
        size="sm"
      >
        {!newKey ? (
          <div>
            <p style={{ marginBottom: 16, color: "var(--text-dim)", lineHeight: 1.5 }}>
              Generate a new API key for programmatic access to Gandy's verification API.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowGenerateKeyModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleGenerateKey}>
                Generate Key
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ padding: 12, background: "var(--warn-soft)", border: "1px solid var(--warn)", borderRadius: "var(--r-3)", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--warn)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Important
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text)" }}>
                Copy this key now. You won't be able to see it again!
              </div>
            </div>
            <div style={{ padding: 12, background: "var(--bg-elev)", border: "1px solid var(--hairline)", borderRadius: "var(--r-2)", fontFamily: "var(--font-mono)", fontSize: 11.5, wordBreak: "break-all", marginBottom: 16 }}>
              {newKey}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <CopyButton text={newKey} onCopy={handleCopyKey}>
                Copy Key
              </CopyButton>
              <button className="btn btn-primary" onClick={() => {
                setShowGenerateKeyModal(false);
                setNewKey(null);
              }}>
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Member Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteMemberConfirm}
        onClose={() => {
          setShowDeleteMemberConfirm(false);
          setSelectedMember(null);
        }}
        onConfirm={handleDeleteMember}
        title="Remove Team Member?"
        message={selectedMember ? `Remove ${selectedMember.email} from the team? They will lose access immediately.` : ''}
        confirmText="Remove"
        confirmStyle="danger"
      />

      {/* Delete API Key Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteKeyConfirm}
        onClose={() => {
          setShowDeleteKeyConfirm(false);
          setSelectedKey(null);
        }}
        onConfirm={handleDeleteKey}
        title="Delete API Key?"
        message="This will immediately revoke access for any applications using this key. This action cannot be undone."
        confirmText="Delete"
        confirmStyle="danger"
      />
    </main>
  );
}

Object.assign(window, { SettingsScreen });

// Made with Bob
