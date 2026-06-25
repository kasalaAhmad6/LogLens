import React from 'react';
import { History, RefreshCw, FileText } from 'lucide-react';

export default function JobSelector({ jobs, activeJobId, onSelectJob, onRefresh }) {
  
  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={18} />
          <span>Analysis History</span>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={onRefresh} 
          style={{ padding: '6px', borderRadius: '4px' }}
          title="Refresh Job History"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="job-list">
        {jobs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            No previous logs analyzed.
          </p>
        ) : (
          jobs.map((job) => {
            const isActive = job.id === activeJobId;
            return (
              <div 
                key={job.id} 
                className={`job-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectJob(job)}
              >
                <div className="job-item-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)' }} />
                    <span className="job-filename" title={job.filename}>{job.filename}</span>
                  </div>
                  <span className={`job-badge ${job.status}`}>
                    {job.status}
                  </span>
                </div>

                {job.status === 'processing' && (
                  <div className="job-progress-container">
                    <div className="progress-bar-bg">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${job.progress || 0}%` }}
                      ></div>
                    </div>
                    <div className="job-progress-text">
                      <span>Parsing Lines</span>
                      <span>{job.progress || 0}%</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>{formatDate(job.created_at)}</span>
                  {job.status === 'completed' && (
                    <span style={{ color: job.attacks_found > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
                      {job.attacks_found} threats
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
