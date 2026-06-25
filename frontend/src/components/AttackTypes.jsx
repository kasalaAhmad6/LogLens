import React from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip,
  Legend
} from 'recharts';
import { Shield } from 'lucide-react';

const ATTACK_NAMES = {
  sql_injection: 'SQL Injection',
  xss: 'Cross-Site Scripting',
  directory_traversal: 'Directory Traversal',
  brute_force: 'Brute Force'
};

const COLORS = {
  sql_injection: '#ef4444',     // Red
  xss: '#fbbf24',             // Yellow/Amber
  directory_traversal: '#3b82f6',     // Blue
  brute_force: '#ec4899'         // Pink/Purple
};

export default function AttackTypes({ data }) {
  const chartData = data.map(item => ({
    name: ATTACK_NAMES[item.type] || item.type,
    value: item.count,
    rawType: item.type
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: '#0f172a',
          border: `1px solid ${COLORS[data.rawType] || 'var(--panel-border)'}`,
          padding: '10px 14px',
          borderRadius: '6px',
          boxShadow: 'var(--shadow-md)'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)' }}>
            {data.name}
          </p>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: COLORS[data.rawType] }}>
            Count: {data.value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="panel" style={{ flex: '0 0 340px', minHeight: '340px' }}>
      <div className="panel-title">
        <Shield size={20} style={{ color: 'var(--primary)' }} />
        <span>Threat Breakdown</span>
      </div>
      
      {chartData.length === 0 ? (
        <div className="empty-state">
          <p>No attack categories detected.</p>
        </div>
      ) : (
        <div style={{ width: '100%', height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <ResponsiveContainer width="100%" height="80%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.rawType] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Custom legend layout for details */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px 16px',
            fontSize: '12px',
            width: '100%',
            padding: '0 10px',
            marginTop: '-10px'
          }}>
            {chartData.map((entry, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '20%',
                  background: COLORS[entry.rawType] || '#94a3b8',
                  display: 'inline-block'
                }}></span>
                <span className="job-filename" style={{ color: 'var(--text-muted)', fontSize: '11px', maxWidth: '100px' }}>{entry.name}</span>
                <strong style={{ marginLeft: 'auto' }}>{entry.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
