import React, { useState, useRef } from 'react';
import { UploadCloud, Play } from 'lucide-react';

export default function UploadArea({ onJobCreated, onError }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const uploadFile = (file) => {
    // Basic file extension checking
    if (!file.name.endsWith('.log') && !file.name.endsWith('.txt') && !file.name.endsWith('.data')) {
      onError('Invalid file format. Please upload a .log, .txt or .data log file.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status === 202) {
        const response = JSON.parse(xhr.responseText);
        onJobCreated(response.jobId);
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          onError(err.error || 'Upload failed. Please try again.');
        } catch {
          onError('Server returned an error. Please try again.');
        }
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      onError('Network error. Failed to upload file.');
    };

    xhr.send(formData);
  };

  const loadDemo = async () => {
    setLoadingDemo(true);
    try {
      const response = await fetch('/api/jobs/demo', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to start demo job');
      }
      const data = await response.json();
      onJobCreated(data.jobId);
    } catch (err) {
      onError(err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="panel-title">
        <UploadCloud size={20} />
        <span>Analyze Log File</span>
      </div>
      
      <div 
        className={`dropzone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={uploading ? null : onButtonClick}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          style={{ display: 'none' }} 
          onChange={handleChange}
          disabled={uploading}
        />
        
        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
            <div className="spinner"></div>
            <div className="dropzone-text">Uploading File...</div>
            <div style={{ width: '80%', maxWidth: '300px' }}>
              <div className="progress-bar-bg" style={{ height: '8px' }}>
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Network Upload</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <UploadCloud className="dropzone-icon" />
            <div className="dropzone-text">Drag and drop your server log file here</div>
            <div className="dropzone-subtext">Supports Apache & Nginx (Common / Combined Format)</div>
            <button className="btn btn-secondary" style={{ marginTop: '8px' }}>Select File</button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '12px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }}></div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Or Test Drive</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }}></div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button 
          className="btn btn-primary" 
          onClick={loadDemo}
          disabled={loadingDemo || uploading}
          style={{ padding: '12px 28px', gap: '10px' }}
        >
          <Play size={18} fill="currentColor" />
          <span>{loadingDemo ? 'Starting Demo Analysis...' : 'Load Demo Log'}</span>
        </button>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Simulates an immediate upload with typical threat attacks (SQLi, XSS, Traversals, Brute Force)
        </p>
      </div>
    </div>
  );
}
