import React from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { Activity } from 'lucide-react';

export default function AttackTimeline({ data }) {
  // Format timeline data hours to HH:mm format
  const formattedData = data.map(item => {
    try {
      const date = new Date(item.hour);
      // Format as "HH:mm" in local time or simple UTC slice
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return {
        ...item,
        timeLabel: `${hours}:${minutes}`
      };
    } catch {
      return item;
    }
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#0f172a',
          border: '1px solid var(--danger)',
          padding: '10px 14px',
          borderRadius: '6px',
          boxShadow: 'var(--shadow-md)'
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Time: <strong style={{ color: 'var(--text-main)' }}>{label}</strong>
          </p>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--danger)' }}>
            Attacks: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="panel" style={{ flex: 1, minHeight: '340px' }}>
      <div className="panel-title">
        <Activity size={20} style={{ color: 'var(--danger)' }} />
        <span>Attack Frequency Timeline</span>
      </div>
      
      {formattedData.length === 0 ? (
        <div className="empty-state">
          <p>No attack trend data recorded.</p>
        </div>
      ) : (
        <div style={{ width: '100%', height: '260px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formattedData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="attackGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--danger)" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(38, 52, 80, 0.3)" />
              <XAxis 
                dataKey="timeLabel" 
                stroke="var(--text-muted)" 
                fontSize={11}
                tickLine={false}
              />
              <YAxis 
                stroke="var(--text-muted)" 
                fontSize={11}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="var(--danger)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#attackGlow)" 
                activeDot={{ r: 6, stroke: '#0f172a', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
