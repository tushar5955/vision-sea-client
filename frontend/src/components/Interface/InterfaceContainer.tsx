import React, { useEffect, useMemo, useState } from 'react';
import Interact from './Interact';
import CodeEditor from './CodeEditor';
import CyberAvatar from './Avatar/CyberAvatar';
import AvatarCanvas from './Avatar/AvatarCanvas';
import ToolCallPanel from './ToolCallPanel';
import ArtifactPreview from './ArtifactPreview';
import '../../styles/Interface/InterfaceContainer.css';
import { useChatContext } from '../../context/ChatContext';
// Raw source imports for code view in OFF mode
// Note: Vite supports importing file contents with the ?raw suffix
// We scope to known defaults; custom components will fall back to a help message
// eslint-disable-next-line import/no-unresolved
import AvatarCanvasSource from './Avatar/AvatarCanvas.tsx?raw';
// eslint-disable-next-line import/no-unresolved
import CyberAvatarSource from './Avatar/CyberAvatar.tsx?raw';

type AnyProps = Record<string, any>;

export interface PluggableItem {
  key: string;
  label: string;
  component: React.ComponentType<any>;
  props?: AnyProps;
}

interface InterfaceContainerProps {
  // Optional: a single component to render (legacy path)
  dynamicComponent?: React.ComponentType<any>;
  componentProps?: AnyProps;

  // Optional: full registry to enable switching between components
  components?: PluggableItem[];
  defaultKey?: string;
}

const InterfaceContainer: React.FC<InterfaceContainerProps> = (props) => {
  const {
    dynamicComponent,
    componentProps = {},
    components,
    defaultKey,
  } = props;
  // ON = interactive wrapper, OFF = raw component render
  // Default to ON when the app starts
  const [isOn, setIsOn] = useState(true);
  const { toolPanelFocusKey, artifactState } = useChatContext();

  // Build a registry: use provided components or sensible defaults
  const registry = useMemo<PluggableItem[]>(() => {
    const base: PluggableItem[] = [
      {
        key: 'tool-calls',
        label: 'Tool Calls',
        component: ToolCallPanel,
      },
      {
        key: 'cyber-avatar-canvas',
        label: 'Cyber Avatar (Canvas)',
        component: AvatarCanvas,
        props: {
          background: '#0a0f1c',
          headLightColor: '#59afc9',
          headLightIntensity: 0.35,
        },
      },
      {
        key: 'cyber-avatar',
        label: 'Cyber Avatar (Scene Only)',
        component: CyberAvatar,
        props: {
          showSolarSystem: true,
        },
      },
    ];

    // If a single dynamicComponent was passed (legacy), make sure it's available as "custom"
    if (dynamicComponent) {
      base.unshift({
        key: 'custom',
        label: 'Custom Component',
        component: dynamicComponent,
        props: componentProps,
      });
    }

    const artifactEntry = artifactState
      ? {
          key: 'artifact-lab',
          label: artifactState.metadata?.component_name || 'Artifact Lab',
          component: ArtifactPreview,
          props: { artifact: artifactState },
        }
      : null;

    if (components && components.length) {
      return artifactEntry ? [artifactEntry, ...components] : components;
    }

    if (artifactEntry) {
      base.unshift(artifactEntry);
    }
    return base;
  }, [components, dynamicComponent, componentProps, artifactState]);

  // Selected key for switching between components
  const [selectedKey, setSelectedKey] = useState<string>(
    defaultKey || (artifactState ? 'artifact-lab' : 'cyber-avatar-canvas')
  );

  // Find the selected item each render
  const selected = useMemo(() => {
    return registry.find((c) => c.key === selectedKey) || registry[0];
  }, [registry, selectedKey]);

  const SelectedComp = selected?.component;
  const selectedProps = selected?.props ?? {};

  // Map selected key to raw source for the code editor when OFF
  const codeByKey: Record<string, string> = useMemo(() => {
    const mapping: Record<string, string> = {
      'cyber-avatar-canvas': AvatarCanvasSource,
      'cyber-avatar': CyberAvatarSource,
      'tool-calls': '// Tool call dashboard does not expose source code.',
      custom:
        `// No source mapped for this view.\n// To wire it up, add a '?raw' import in InterfaceContainer.tsx\n// and map its key in codeByKey.`,
    };
    if (artifactState?.code) {
      mapping['artifact-lab'] = artifactState.code;
    }
    return mapping;
  }, [artifactState]);
  const currentCode = codeByKey[selected?.key ?? ''] ?? codeByKey.custom;

  useEffect(() => {
    if (!toolPanelFocusKey) {
      return;
    }
    // Only switch to tool calls if not currently viewing an artifact
    if (selectedKey !== 'artifact-lab') {
      setSelectedKey('tool-calls');
      setIsOn(true);
    }
  }, [toolPanelFocusKey, selectedKey]);

  useEffect(() => {
    if (artifactState) {
      setSelectedKey('artifact-lab');
      setIsOn(true);
    }
  }, [artifactState]);

  return (
    <div className="interface-content">
      {/* Header: mode toggle + component switcher */}
      <div className="interface-header" style={{ gap: 12, justifyContent: 'space-between' }}>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${!isOn ? 'active' : ''}`}
            onClick={() => setIsOn(false)}
          >
            📝 OFF
          </button>
          <button
            className={`toggle-btn ${isOn ? 'active' : ''}`}
            onClick={() => setIsOn(true)}
          >
            👁️ ON
          </button>
        </div>

        {/* Component selector for future switching */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="component-select" style={{ color: '#cfe8ff', fontSize: 13, opacity: 0.9 }}>
            View:
          </label>
          <select
            id="component-select"
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(29, 233, 182, 0.2)',
              color: '#e6f7ff',
              padding: '8px 12px',
              borderRadius: 8,
              outline: 'none',
            }}
          >
            {registry.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      <div className="interface-scrollable-content">
        {isOn ? (
          // ON mode: show the avatar/component exactly as the OFF mode previously did
          SelectedComp ? (
            <SelectedComp {...selectedProps} />
          ) : (
            <div style={{ color: '#888', fontStyle: 'italic', padding: 16 }}>No component selected</div>
          )
        ) : (
          // OFF mode: show the Code Editor with the current view's source code
          <CodeEditor initialCode={currentCode} viewMode="code" />
        )}
      </div>
    </div>
  );
};

export default InterfaceContainer;