import React, { useState } from 'react';
import { ShieldAlert, Search, Globe } from 'lucide-react';

// Maps ISO 3166-1 country codes to Flag Emojis
function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode === 'Unknown') return '🌐';
  if (countryCode === 'Local Network') return '🏠';
  
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return countryCode;
  }
}

// Maps ISO codes to full names (for typical attacker countries in demo logs)
const COUNTRY_NAMES = {
  US: 'United States',
  IN: 'India',
  BR: 'Brazil',
  FR: 'France',
  NL: 'Netherlands',
  CN: 'China',
  DE: 'Germany',
  Local: 'Local Network',
  'Local Network': 'Local Network'
};

export default function TopAttackers({ attackers }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAttackers = attackers.filter(att => 
    att.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (att.country && att.country.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="panel" style={{ width: '100%' }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={20} style={{ color: 'var(--danger)' }} />
          <span>Top Malicious Attacking IPs</span>
        </div>
        
        {/* Search filter input */}
        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input 
            type="text" 
            placeholder="Search IP / Country..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              borderRadius: '6px',
              border: '1px solid var(--panel-border)',
              background: '#090d16',
              color: 'var(--text-main)',
              fontSize: '12px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {filteredAttackers.length === 0 ? (
        <div className="empty-state">
          <p>No matching attackers found.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Attacker IP</th>
                <th>Country</th>
                <th>Total Requests</th>
                <th>Attack Requests</th>
                <th>Ratio</th>
                <th>Max Severity</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttackers.map((att, idx) => {
                const ratio = ((att.attack_requests / att.total_requests) * 100).toFixed(1);
                const flag = getFlagEmoji(att.country);
                const countryName = COUNTRY_NAMES[att.country] || att.country || 'Unknown';
                
                return (
                  <tr key={idx}>
                    <td className="ip-mono">{att.ip}</td>
                    <td>
                      <div className="country-cell">
                        <span className="flag" title={countryName}>{flag}</span>
                        <span style={{ fontSize: '13px' }}>{countryName}</span>
                      </div>
                    </td>
                    <td>{att.total_requests.toLocaleString()}</td>
                    <td style={{ fontWeight: '600', color: 'var(--danger)' }}>
                      {att.attack_requests.toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="progress-bar-bg" style={{ width: '60px', height: '6px', margin: 0 }}>
                          <div className="progress-bar-fill" style={{ 
                            width: `${ratio}%`, 
                            backgroundColor: ratio > 50 ? 'var(--danger)' : 'var(--warning)',
                            boxShadow: 'none'
                          }}></div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ratio}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-threat ${att.max_severity || 'low'}`}>
                        {att.max_severity ? att.max_severity.toUpperCase() : 'LOW'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
