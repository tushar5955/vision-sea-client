import React, { useMemo } from 'react';
import { LiveProvider, LivePreview, LiveError } from 'react-live';
import { themes } from 'prism-react-renderer';
import { ArtifactRenderState } from '../../context/ChatContext';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveRadar } from '@nivo/radar';
import '../../styles/Interface/ArtifactPreview.css';

// Safe wrapper to catch runtime errors in generated components
class ArtifactErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="artifact-console-error" style={{ padding: '20px', margin: '10px' }}>
          <strong>Runtime Error:</strong> {this.state.error?.message || 'Component crashed during render'}
          <br /><span style={{ opacity: 0.7, fontSize: '0.8em' }}>The design agent produced invalid telemetry.</span>
        </div>
      );
    }
    return this.props.children;
  }
}

// Safe wrapper components to prevent Nivo crashes from invalid generated props
const SafeResponsiveLine = (props: any) => {
  if (!props.data || !Array.isArray(props.data)) return null;
  return <ResponsiveLine {...props} theme={props.theme || {}} />;
};

const SafeResponsiveBar = (props: any) => {
  // 1. Critical Data Validation
  if (!props.data || !Array.isArray(props.data) || props.data.length === 0) {
    return (
      <div className="artifact-console-error">
        Waiting for telemetry data...
      </div>
    );
  }

  // 2. Structure Validation
  // Ensure explicitly defined indexBy exists, or fall back to finding a valid key
  let indexBy = props.indexBy;
  if (!indexBy) {
    // try to find a string key like 'id', 'name', 'category', 'x'
    const candidate = Object.keys(props.data[0] || {}).find(k => 
      ['id', 'name', 'category', 'label', 'x', 'date', 'time'].includes(k)
    );
    indexBy = candidate || 'id';
  }

  // Filter out invalid data objects that are missing the index
  const validData = props.data.filter((d: any) => d && typeof d === 'object' && d[indexBy] !== undefined);

  if (validData.length === 0) {
    return <div className="artifact-console-error">Invalid chart data: missing index '{indexBy}'</div>;
  }

  // 3. Prop Sanitization & Defaults
  const safeProps = {
    ...props,
    data: validData,
    indexBy: indexBy,
    // Ensure keys is an array if provided, else infer from first data item (excluding index)
    keys: Array.isArray(props.keys) && props.keys.length > 0 
      ? props.keys 
      : Object.keys(validData[0]).filter(k => k !== indexBy && typeof validData[0][k] === 'number'),
    
    margin: props.margin || { top: 20, right: 20, bottom: 50, left: 60 },
    
    // Safety defaults for axes against undefined config
    axisBottom: props.axisBottom === null ? null : (props.axisBottom || {
      tickSize: 5,
      tickPadding: 5,
      tickRotation: 0,
      legend: String(indexBy),
      legendPosition: 'middle',
      legendOffset: 36
    }),
    
    axisLeft: props.axisLeft === null ? null : (props.axisLeft || {
      tickSize: 5,
      tickPadding: 5,
      tickRotation: 0,
      legend: 'value',
      legendPosition: 'middle',
      legendOffset: -40
    }),

    // Robust theme fallback
    theme: props.theme || {
      background: 'transparent',
      text: { fill: '#a9bfdc', fontSize: 11 },
      axis: {
        domain: { line: { stroke: 'rgba(148, 197, 255, 0.3)', strokeWidth: 1 } },
        ticks: { line: { stroke: 'rgba(148, 197, 255, 0.3)', strokeWidth: 1 }, text: { fill: '#a9bfdc' } },
        legend: { text: { fill: '#a9bfdc' } }
      },
      grid: { line: { stroke: 'rgba(255, 255, 255, 0.08)', strokeWidth: 1 } },
      tooltip: { container: { background: '#0a1628', color: '#e6f7ff', fontSize: 12 } }
    },

    // Visual defaults commonly missed
    padding: props.padding ?? 0.3,
    labelSkipWidth: props.labelSkipWidth ?? 12,
    labelSkipHeight: props.labelSkipHeight ?? 12,
    labelTextColor: props.labelTextColor || { from: 'color', modifiers: [['darker', 1.6]] },
    colors: props.colors || { scheme: 'nivo' },
    animate: props.animate ?? true,
  };

  return <ResponsiveBar {...safeProps} />;
};

const SafeResponsivePie = (props: any) => {
  if (!props.data || !Array.isArray(props.data)) return null;
  return <ResponsivePie {...props} theme={props.theme || {}} />;
};

const SafeResponsiveRadar = (props: any) => {
  if (!props.data || !Array.isArray(props.data)) return null;
  return <ResponsiveRadar {...props} theme={props.theme || {}} />;
};

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
      ResponsiveLine: SafeResponsiveLine,
      ResponsiveBar: SafeResponsiveBar,
      ResponsivePie: SafeResponsivePie,
      ResponsiveRadar: SafeResponsiveRadar,
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

const ArtifactPlaceholder = () => {
  const gridLines = [20, 60, 100, 140];

  return (
    <div className="artifact-runtime-surface">
      <div className="artifact-panel accent">
        <p className="artifact-section-label">Neural Brief</p>
        <h3>Artifact Stream Initializing</h3>
        <p>The design agent is preparing holographic telemetry. Charts will snap into place once the next artifact chunk arrives.</p>
        <button className="artifact-cta">Stand by</button>
      </div>

      <div className="artifact-layer-grid">
        <div className="artifact-panel">
          <p className="artifact-metric-label">Signal Sync</p>
          <p className="artifact-metric-value">72<sup>%</sup></p>
          <span className="artifact-metric-pill">calibrating</span>
        </div>
        <div className="artifact-panel transparent">
          <p className="artifact-metric-label">Context Depth</p>
          <p className="artifact-metric-value">48</p>
          <span className="artifact-metric-pill">channels</span>
        </div>
      </div>

      <div className="artifact-chart-card">
        <svg viewBox="0 0 320 160" preserveAspectRatio="none">
          <defs>
            <linearGradient id="placeholderLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#24f2c6" />
              <stop offset="100%" stopColor="#7ee4ff" />
            </linearGradient>
          </defs>
          {gridLines.map((y) => (
            <line key={'grid-' + y} x1="0" x2="320" y1={y} y2={y} className="chart-grid-line" />
          ))}
          <path
            className="chart-line"
            d="M0 120 C 60 80, 140 140, 220 70, 320 105"
            stroke="url(#placeholderLine)"
          />
          <path
            className="chart-pulse"
            d="M0 120 C 60 80, 140 140, 220 70, 320 105"
            stroke="url(#placeholderLine)"
          />
          <text x="12" y="28">Signal Drift</text>
          <text x="12" y="46">Stabilizing Flux</text>
        </svg>
      </div>
    </div>
  );
};

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
                <ArtifactErrorBoundary>
                  <LivePreview />
                </ArtifactErrorBoundary>
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
