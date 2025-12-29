import React, { useMemo, useState } from 'react';
import { useChatContext } from '../../context/ChatContext';
import '../../styles/Interface/ToolCallPanel.css';

const formatJson = (value: any) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'success':
      return 'badge-success';
    case 'error':
      return 'badge-error';
    case 'awaiting-approval':
      return 'badge-pending';
    default:
      return 'badge-running';
  }
};

const ToolCallPanel: React.FC = () => {
  const {
    toolEvents,
    hitlRequest,
    submitHitlDecision,
    isSubmittingHitl,
    latestToolEventId,
  } = useChatContext();
  const [editArgs, setEditArgs] = useState('');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const sortedEvents = useMemo(
    () => [...toolEvents].sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    [toolEvents],
  );

  const currentAction = hitlRequest?.actions?.[0];

  const handleDecision = async (decision: 'approve' | 'reject' | 'skip' | 'edit') => {
    if (!hitlRequest || !currentAction) return;
    setLocalError(null);

    let editedPayload: Record<string, any> | undefined;
    if (decision === 'edit') {
      try {
        editedPayload = editArgs ? JSON.parse(editArgs) : currentAction.args;
      } catch (err) {
        setLocalError('Invalid JSON for edited arguments.');
        return;
      }
    }

    await submitHitlDecision({
      action: currentAction,
      decision,
      editedArgs: editedPayload,
      reason: reason || undefined,
    });
  };

  React.useEffect(() => {
    if (currentAction) {
      setEditArgs(JSON.stringify(currentAction.args || {}, null, 2));
      setReason('');
      setLocalError(null);
    } else {
      setEditArgs('');
      setReason('');
      setLocalError(null);
    }
  }, [currentAction]);

  return (
    <div className="tool-call-panel">
      <header className="tool-call-header">
        <div>
          <p className="eyebrow">Agent Execution Timeline</p>
          <h3>Tool Calls & Approvals</h3>
        </div>
        <div className="live-indicator">
          <span className="dot" /> Live updates
        </div>
      </header>

      <section className="tool-timeline">
        {sortedEvents.length === 0 ? (
          <div className="tool-empty">
            <p>No tool activity yet. Ask the agent to use an MCP tool to see live updates.</p>
          </div>
        ) : (
          sortedEvents.map(step => (
            <article
              key={step.id}
              className={`tool-card ${step.type} ${latestToolEventId === step.id ? 'pulse' : ''}`}
            >
              <div className="tool-card-header">
                <div>
                  <span className={`status-badge ${statusBadge(step.status)}`}>
                    {step.status.replace('-', ' ')}
                  </span>
                  <h4>{step.toolName}</h4>
                </div>
                <time>{new Date(step.startedAt).toLocaleTimeString()}</time>
              </div>
              <div className="tool-body">
                <div>
                  <p className="label">Arguments</p>
                  <pre>{formatJson(step.args)}</pre>
                </div>
                {step.output !== undefined && (
                  <div>
                    <p className="label">Output</p>
                    <pre>{formatJson(step.output)}</pre>
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      {hitlRequest && currentAction && (
        <section className="hitl-panel">
          <div className="hitl-panel-header">
            <h4>Human approval required</h4>
            <p>{currentAction.name} awaits your decision.</p>
          </div>
          <div className="hitl-fields">
            <div>
              <label>Review / edit arguments</label>
              <textarea
                value={editArgs}
                onChange={e => setEditArgs(e.target.value)}
                rows={6}
                spellCheck={false}
              />
            </div>
            <div>
              <label>Reason (optional)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="Why approve, reject, or skip?"
              />
            </div>
            {localError && <p className="hitl-error">{localError}</p>}
          </div>
          <div className="hitl-actions">
            <button
              className="ghost"
              disabled={isSubmittingHitl}
              onClick={() => handleDecision('skip')}
            >
              Skip
            </button>
            <button
              className="reject"
              disabled={isSubmittingHitl}
              onClick={() => handleDecision('reject')}
            >
              Reject
            </button>
            <button
              className="edit"
              disabled={isSubmittingHitl}
              onClick={() => handleDecision('edit')}
            >
              Send edits
            </button>
            <button
              className="approve"
              disabled={isSubmittingHitl}
              onClick={() => handleDecision('approve')}
            >
              Approve
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default ToolCallPanel;
