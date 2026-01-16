import React, { useMemo } from 'react';
import { LiveProvider, LivePreview, LiveError } from 'react-live';
import { themes } from 'prism-react-renderer';
import { ArtifactRenderState } from '../../context/ChatContext';
import '../../styles/Interface/ArtifactPreview.css';

interface ArtifactPreviewProps {
  artifact: ArtifactRenderState;
}

const statusLabel: Record<string, string> = {
  generating: 'Synthesizing',
  ready: 'Live',
  error: 'Fault',
  idle: 'Standby',
};

const ArtifactPreview: React.FC<ArtifactPreviewProps> = ({ artifact }) => {
  const scope = useMemo(
    () => ({
      React,
      useState: React.useState,
      useEffect: React.useEffect,
      useMemo: React.useMemo,
    }),
    [],
  );

  const chunkTrail = useMemo(() => {
    if (artifact.chunks.length) {
      return artifact.chunks.slice(-80);
    }
    return artifact.code
      ? artifact.code.split(/(?<=\n)/).slice(-40)
      : ['// awaiting artifact code...'];
  }, [artifact.chunks, artifact.code]);

  const previewCode = useMemo(() => {
    const rawCode = (artifact.code && artifact.code.trim()) || `import React from 'react';

const ArtifactPlaceholder: React.FC = () => (
  <div style={{
    width: '100%',
    minHeight: '240px',
    color: '#94a3b8',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15,23,42,0.35)',
    border: '1px dashed rgba(148,163,184,0.3)',
    borderRadius: '18px'
  }}>
    Artifact stream initializing...
  </div>
);

render(<ArtifactPlaceholder />);`;

    // Extract component name from code
    const componentMatch = rawCode.match(/(?:const|function)\s+(\w+)\s*[:=]/);
    const componentName = componentMatch ? componentMatch[1] : 'Component';

    // Auto-append render call if not present (required for noInline mode)
    if (!rawCode.includes('render(')) {
      return `${rawCode}\n\nrender(<${componentName} />);`;
    }
    return rawCode;
  }, [artifact.code]);

  const status = artifact.status || 'idle';
  const pillLabel = statusLabel[status] || status;
  const isGenerating = status === 'generating';
  const showCode = isGenerating || status === 'idle';
  const showComponent = status === 'ready' && !isGenerating;

  return (
    <div className="artifact-lab-container">
      <section className="artifact-unified-panel">
        <header className="artifact-console-header">
          <div>
            <p className="artifact-console-eyebrow">Neural Artifact Forge</p>
            <h4>{artifact.metadata?.component_name || 'Artifact Lab'}</h4>
          </div>
          <div className={`artifact-status-pill ${status}`}>
            <span className="pulse" />
            {pillLabel}
          </div>
        </header>
        
        {showCode && (
          <div className={`artifact-stream-shell ${showComponent ? 'fade-out' : ''}`}>
            <div className="artifact-stream-matrix">
              {chunkTrail.map((chunk, idx) => {
                const delay = (idx * 0.015) % 2;
                return (
                  <span 
                    key={`chunk-${idx}`} 
                    className="artifact-code-chunk matrix-flow"
                    style={{
                      animationDelay: `${delay}s`,
                      opacity: Math.max(0.3, 1 - (chunkTrail.length - idx) * 0.008)
                    }}
                  >
                    {chunk}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {showComponent && (
          <div className="artifact-component-display fade-in">
            <LiveProvider
              code={previewCode}
              noInline
              scope={scope}
              theme={themes.nightOwl}
            >
              <div className="artifact-preview-stage">
                <LivePreview />
              </div>
              <LiveError className="artifact-live-error" />
            </LiveProvider>
          </div>
        )}

        {artifact.error && (
          <div className="artifact-console-error">⚠️ {artifact.error}</div>
        )}
      </section>
    </div>
  );
};

export default ArtifactPreview;
