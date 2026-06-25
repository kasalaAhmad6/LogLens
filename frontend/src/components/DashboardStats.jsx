import React from 'react';
import { ShieldAlert, Server, Activity, Users } from 'lucide-react';

export default function DashboardStats({ stats }) {
  const { totalLogs, totalAttacks, uniqueIPs, highSeverity } = stats;
  
  // Calculate threat ratio
  const threatRatio = totalLogs > 0 ? ((totalAttacks / totalLogs) * 100).toFixed(2) : '0.00';

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon primary">
          <Server size={24} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Logs Analyzed</span>
          <span className="stat-value">{totalLogs.toLocaleString()}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon danger">
          <ShieldAlert size={24} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Attacks Blocked</span>
          <span className="stat-value" style={{ color: 'var(--danger)' }}>
            {totalAttacks.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon warning">
          <Activity size={24} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Attack Ratio</span>
          <span className="stat-value" style={{ color: 'var(--warning)' }}>
            {threatRatio}%
          </span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon success">
          <Users size={24} />
        </div>
        <div className="stat-info">
          <span className="stat-label">Unique Attackers</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>
            {uniqueIPs.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
