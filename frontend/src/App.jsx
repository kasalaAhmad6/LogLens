import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import UploadArea from './components/UploadArea';
import JobSelector from './components/JobSelector';
import DashboardStats from './components/DashboardStats';
import AttackTimeline from './components/AttackTimeline';
import AttackTypes from './components/AttackTypes';
import TopAttackers from './components/TopAttackers';

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [reportData, setReportData] = useState(null);
  
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState(null);
  const [viewingDashboard, setViewingDashboard] = useState(false);

  const pollingIntervalRef = useRef(null);

  // Initial jobs load
  useEffect(() => {
    fetchJobs();
    return () => clearInterval(pollingIntervalRef.current);
  }, []);

  // Monitor active job for polling progress
  useEffect(() => {
    if (activeJobId) {
      // Start polling
      pollingIntervalRef.current = setInterval(pollJobStatus, 1500);
    } else {
      clearInterval(pollingIntervalRef.current);
    }

    return () => clearInterval(pollingIntervalRef.current);
  }, [activeJobId]);

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to load jobs list.');
      const data = await response.json();
      setJobs(data);

      // Check if any job is currently processing or pending
      const activeJob = data.find(j => j.status === 'processing' || j.status === 'pending');
      if (activeJob && activeJob.id !== activeJobId) {
        setActiveJobId(activeJob.id);
      }
    } catch (err) {
      console.error(err);
      setError('Could not establish contact with backend server.');
    }
  };

  const pollJobStatus = async () => {
    if (!activeJobId) return;
    try {
      const response = await fetch(`/api/jobs/${activeJobId}/status`);
      if (!response.ok) throw new Error('Error checking job status.');
      const job = await response.json();

      // Update that specific job in the list
      setJobs(prevJobs => prevJobs.map(j => j.id === job.id ? job : j));

      if (job.status === 'completed') {
        setActiveJobId(null);
        // Load report and switch view automatically
        handleSelectJob(job);
      } else if (job.status === 'failed') {
        setActiveJobId(null);
        setError('Log parsing engine encountered a failure on this file.');
        fetchJobs();
      }
    } catch (err) {
      console.error(err);
      setActiveJobId(null);
      setError('Connection interrupted while monitoring job.');
    }
  };

  const handleSelectJob = async (job) => {
    setSelectedJob(job);
    setError(null);

    if (job.status === 'completed') {
      setLoadingReport(true);
      try {
        const response = await fetch(`/api/jobs/${job.id}/report`);
        if (!response.ok) throw new Error('Failed to retrieve report data.');
        const data = await response.json();
        
        setReportData(data);
        setViewingDashboard(true);
        fetchJobs(); // Update counts in history list
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingReport(false);
      }
    } else if (job.status === 'processing' || job.status === 'pending') {
      setActiveJobId(job.id);
      setViewingDashboard(false);
    } else {
      setError('This job failed. Please upload a new log file.');
    }
  };

  const handleJobCreated = (jobId) => {
    setError(null);
    setActiveJobId(jobId);
    fetchJobs();
  };

  const handleExportReport = () => {
    if (!reportData) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const sanitizedFilename = reportData.job.filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadAnchor.setAttribute("download", `loglens_report_${sanitizedFilename}_${reportData.job.id.slice(0, 8)}.json`);
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleBackToUpload = () => {
    setViewingDashboard(false);
    setSelectedJob(null);
    setReportData(null);
    fetchJobs();
  };

  return (
    <div className="app-container">
      <header>
        <div className="brand">
          <div className="brand-logo">LOGLENS</div>
          <div className="brand-badge">SIEM-Lite</div>
        </div>
        
        {viewingDashboard && (
          <button className="btn btn-secondary" onClick={handleBackToUpload}>
            <ArrowLeft size={16} />
            <span>Upload Panel</span>
          </button>
        )}
      </header>

      {error && (
        <div className="panel" style={{ 
          borderColor: 'var(--danger)', 
          background: 'rgba(239, 68, 68, 0.08)',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} />
          <span style={{ fontSize: '14px', fontWeight: '500' }}>{error}</span>
          <button 
            className="btn btn-secondary" 
            onClick={() => setError(null)} 
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '11px', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Router */}
      {!viewingDashboard && !activeJobId && (
        <div className="upload-grid">
          <UploadArea 
            onJobCreated={handleJobCreated} 
            onError={(msg) => setError(msg)} 
          />
          <JobSelector 
            jobs={jobs} 
            activeJobId={selectedJob?.id}
            onSelectJob={handleSelectJob} 
            onRefresh={fetchJobs}
          />
        </div>
      )}

      {/* activeJobId Polling Screen */}
      {activeJobId && !viewingDashboard && (
        <div className="panel loading-container">
          <div className="spinner"></div>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Processing Security Logs</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '400px', textAlign: 'center' }}>
            LogLens is scanning the stream and validating entries against the threat signature library.
          </p>
          
          {(() => {
            const currentJob = jobs.find(j => j.id === activeJobId);
            if (!currentJob) return null;
            return (
              <div style={{ width: '100%', maxWidth: '400px', marginTop: '16px' }}>
                <div className="progress-bar-bg" style={{ height: '10px' }}>
                  <div className="progress-bar-fill" style={{ width: `${currentJob.progress || 0}%` }}></div>
                </div>
                <div className="job-progress-text" style={{ fontSize: '12px' }}>
                  <span>{currentJob.filename}</span>
                  <strong>{currentJob.progress || 0}% Completed</strong>
                </div>
                <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
                  Parsed lines: {(currentJob.parsed_lines || 0).toLocaleString()} | Threats flagged: {currentJob.attacks_found || 0}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* reportData Loaded Dashboard View */}
      {viewingDashboard && reportData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Dashboard Header Bar */}
          <div className="panel" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 24px', 
            background: 'rgba(30, 41, 59, 0.4)' 
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} style={{ color: 'var(--success)' }} />
                <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Analysis Report: {reportData.job.filename}</h2>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Job ID: <span className="ip-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{reportData.job.id}</span> | Completed in {((new Date(reportData.job.finished_at) - new Date(reportData.job.created_at))/1000).toFixed(1)}s
              </p>
            </div>
            
            <button className="btn btn-primary" onClick={handleExportReport} style={{ gap: '8px' }}>
              <Download size={16} />
              <span>Export Report</span>
            </button>
          </div>

          {/* Metric Stats Panels */}
          <DashboardStats stats={reportData.stats} />

          {/* Visual Charts Layout */}
          <div className="report-grid">
            <AttackTimeline data={reportData.timeline} />
            <AttackTypes data={reportData.distribution} />
          </div>

          {/* Top Attacking IPs */}
          <TopAttackers attackers={reportData.attackers} />
        </div>
      )}
    </div>
  );
}
