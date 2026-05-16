/* global React, useApp, useToast, Modal, exportToCSV, exportToPDF, IconFilter, IconDownload, IconEye */
const { useState, useMemo } = React;

function ReportsScreen() {
  const { state } = useApp();
  const toast = useToast();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showReportDetail, setShowReportDetail] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    repo: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const reports = state.reports || [];

  // Apply filters
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      if (filters.status !== 'all' && report.status !== filters.status) return false;
      if (filters.repo !== 'all' && report.repo !== filters.repo) return false;
      if (filters.dateFrom && report.date < filters.dateFrom) return false;
      if (filters.dateTo && report.date > filters.dateTo) return false;
      return true;
    });
  }, [reports, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportAll = () => {
    const exportData = filteredReports.map(r => ({
      'Report ID': r.id,
      'PR': r.pr,
      'Title': r.title,
      'Repository': r.repo,
      'Date': r.date,
      'Time': r.time,
      'Status': r.status,
      'Iterations': r.iteration,
      'Duration': r.duration
    }));
    
    exportToCSV(exportData, `gandy-reports-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success(`Exported ${exportData.length} reports to CSV`);
  };

  const handleDownloadReport = (report) => {
    const reportData = {
      id: report.id,
      pr: report.pr,
      title: report.title,
      repository: report.repo,
      date: report.date,
      time: report.time,
      status: report.status,
      iterations: report.iteration,
      duration: report.duration,
      frameworks: report.frameworks,
      failReason: report.failReason || 'N/A'
    };
    
    exportToPDF(reportData, `${report.id}.pdf`);
    toast.success(`Downloaded report ${report.id}`);
  };

  const handleViewReport = (report) => {
    setSelectedReport(report);
    setShowReportDetail(true);
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setShowFilterModal(false);
    toast.success('Filters applied');
  };

  const handleClearFilters = () => {
    setFilters({
      status: 'all',
      repo: 'all',
      dateFrom: '',
      dateTo: ''
    });
    setCurrentPage(1);
    toast.info('Filters cleared');
  };

  const uniqueRepos = [...new Set(reports.map(r => r.repo))];

  return (
    <main className="content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Verification Reports</h1>
          <p className="page-sub">
            Complete audit trail of all verification runs
            {filteredReports.length !== reports.length && (
              <span style={{ color: "var(--accent)", marginLeft: 8 }}>
                ({filteredReports.length} of {reports.length} shown)
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowFilterModal(true)}>
            <IconFilter /> Filter
          </button>
          <button className="btn btn-sm" onClick={handleExportAll}>
            <IconDownload /> Export all
          </button>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>PR</th>
              <th>Repository</th>
              <th>Date</th>
              <th>Status</th>
              <th>Iterations</th>
              <th>Duration</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paginatedReports.map((report, i) => (
              <tr key={i}>
                <td>
                  <span className="mono" style={{ color: "var(--text)" }}>{report.id}</span>
                </td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: "var(--text)" }}>#{report.pr}</span>
                    <span style={{ fontSize: 11, color: "var(--text-mute)" }}>{report.title}</span>
                  </div>
                </td>
                <td>
                  <span className="mono">{report.repo}</span>
                </td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: "var(--text-dim)" }}>{report.date}</span>
                    <span className="mono" style={{ fontSize: 10.5 }}>{report.time}</span>
                  </div>
                </td>
                <td>
                  <span className={`status ${report.status === "passed" ? "pass" : "fail"}`}>
                    <span className="dot" />
                    {report.status}
                  </span>
                </td>
                <td>
                  <span className="mono">{report.iteration}</span>
                </td>
                <td>
                  <span className="mono">{report.duration}</span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleViewReport(report)}>
                      <IconEye /> View
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDownloadReport(report)}>
                      <IconDownload />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--text-mute)" }}>
        <span>Showing {paginatedReports.length} of {filteredReports.length} reports</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button 
            className="btn btn-ghost btn-sm" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            Previous
          </button>
          <span style={{ padding: "4px 12px", color: "var(--text)" }}>
            Page {currentPage} of {totalPages || 1}
          </span>
          <button 
            className="btn btn-ghost btn-sm"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter Reports"
        size="sm"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="all">All</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Repository</label>
            <select
              className="form-select"
              value={filters.repo}
              onChange={(e) => setFilters({ ...filters, repo: e.target.value })}
            >
              <option value="all">All Repositories</option>
              {uniqueRepos.map(repo => (
                <option key={repo} value={repo}>{repo}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date From</label>
            <input
              type="date"
              className="form-input"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date To</label>
            <input
              type="date"
              className="form-input"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid var(--hairline)" }}>
            <button className="btn btn-ghost" onClick={handleClearFilters}>
              Clear
            </button>
            <button className="btn btn-primary" onClick={handleApplyFilters}>
              Apply Filters
            </button>
          </div>
        </div>
      </Modal>

      {/* Report Detail Modal */}
      {selectedReport && (
        <Modal
          isOpen={showReportDetail}
          onClose={() => {
            setShowReportDetail(false);
            setSelectedReport(null);
          }}
          title={`Report ${selectedReport.id}`}
          size="lg"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 16px", fontSize: 13 }}>
              <span style={{ color: "var(--text-mute)" }}>PR:</span>
              <span style={{ color: "var(--text)" }}>#{selectedReport.pr} - {selectedReport.title}</span>
              
              <span style={{ color: "var(--text-mute)" }}>Repository:</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{selectedReport.repo}</span>
              
              <span style={{ color: "var(--text-mute)" }}>Date:</span>
              <span style={{ color: "var(--text)" }}>{selectedReport.date} at {selectedReport.time}</span>
              
              <span style={{ color: "var(--text-mute)" }}>Status:</span>
              <span className={`status ${selectedReport.status === "passed" ? "pass" : "fail"}`}>
                <span className="dot" />
                {selectedReport.status}
              </span>
              
              <span style={{ color: "var(--text-mute)" }}>Iterations:</span>
              <span style={{ color: "var(--text)" }}>{selectedReport.iteration}</span>
              
              <span style={{ color: "var(--text-mute)" }}>Duration:</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{selectedReport.duration}</span>
              
              <span style={{ color: "var(--text-mute)" }}>Frameworks:</span>
              <span style={{ color: "var(--text)" }}>
                Math: {selectedReport.frameworks.math}, Game Theory: {selectedReport.frameworks.game}
              </span>
            </div>

            {selectedReport.failReason && (
              <div style={{ padding: 12, background: "var(--fail-soft)", border: "1px solid var(--fail)", borderRadius: "var(--r-3)" }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--fail)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Failure Reason
                </div>
                <div style={{ fontSize: 13, color: "var(--text)" }}>
                  {selectedReport.failReason}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, paddingTop: 16, borderTop: "1px solid var(--hairline)" }}>
              <button className="btn btn-primary" onClick={() => handleDownloadReport(selectedReport)}>
                <IconDownload /> Download PDF
              </button>
              <button className="btn btn-ghost" onClick={() => setShowReportDetail(false)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

Object.assign(window, { ReportsScreen });

// Made with Bob
