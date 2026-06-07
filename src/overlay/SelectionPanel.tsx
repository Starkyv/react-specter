/**
 * react-specter overlay — selection panel: breadcrumb, request box, instance
 * guard, and the outputs (Send to agent / Copy for ticket / Create ticket).
 */
import cx from './cx';
import { getConfig } from './options';
import { componentOf, InstanceVsShared, sourceOf } from './payload';

export interface SelectionPanelProps {
  anchor: HTMLElement;
  chain: HTMLElement[];
  chainIndex: number;
  onChainIndexChange: (index: number) => void;
  userRequest: string;
  onUserRequestChange: (value: string) => void;
  instanceCount: number;
  instanceVsShared: InstanceVsShared | null;
  onInstanceVsSharedChange: (value: InstanceVsShared) => void;
  feedback: string;
  onSendToAgent: () => void;
  onCopyTicket: () => void;
  ticketTitle: string;
  onTicketTitleChange: (value: string) => void;
  onCreateTicket: () => void;
  isCreatingTicket: boolean;
  createdTicket: { id: string; url: string } | null;
  onClose: () => void;
}

const SNIPPET_PREVIEW_MAX = 180;

export default function SelectionPanel({
  anchor,
  chain,
  chainIndex,
  onChainIndexChange,
  userRequest,
  onUserRequestChange,
  instanceCount,
  instanceVsShared,
  onInstanceVsSharedChange,
  feedback,
  onSendToAgent,
  onCopyTicket,
  ticketTitle,
  onTicketTitleChange,
  onCreateTicket,
  isCreatingTicket,
  createdTicket,
  onClose,
}: SelectionPanelProps) {
  const { agentLabel, onCreateTicket: createTicketFn } = getConfig();
  const { file, line } = sourceOf(anchor);
  const needsGuardAnswer = instanceCount > 1 && instanceVsShared === null;
  const snippet = anchor.outerHTML.slice(0, SNIPPET_PREVIEW_MAX);

  return (
    <aside className="specter-panel">
      <header className="specter-header">
        <span className="specter-title">Specter</span>
        <button type="button" className="specter-close" onClick={onClose} title="Close (Esc)">
          ✕
        </button>
      </header>

      <nav className="specter-breadcrumb" aria-label="Ancestor components (↑/↓ to walk)">
        {chain.map((el, i) => (
          <button
            key={`${componentOf(el)}-${i}`}
            type="button"
            className={cx('specter-crumb', i === chainIndex && 'is-active')}
            onClick={() => onChainIndexChange(i)}>
            {componentOf(el)}
          </button>
        ))}
      </nav>

      <dl className="specter-meta">
        <div className="specter-meta-row">
          <dt>Source</dt>
          <dd>
            <code>
              {file}:{line}
            </code>
          </dd>
        </div>
        <div className="specter-meta-row">
          <dt>Element</dt>
          <dd>
            <code>{snippet}</code>
          </dd>
        </div>
      </dl>

      {instanceCount > 1 && (
        <fieldset className="specter-guard">
          <legend>
            This element renders {instanceCount}× on this page. Change just this instance, or the component everywhere?
          </legend>
          <label className="specter-guard-option">
            <input
              type="radio"
              name="specter-instance-vs-shared"
              checked={instanceVsShared === 'instance'}
              onChange={() => onInstanceVsSharedChange('instance')}
            />
            Just this instance
          </label>
          <label className="specter-guard-option">
            <input
              type="radio"
              name="specter-instance-vs-shared"
              checked={instanceVsShared === 'shared'}
              onChange={() => onInstanceVsSharedChange('shared')}
            />
            This component everywhere
          </label>
        </fieldset>
      )}

      <label className="specter-request-label" htmlFor="specter-request">
        What do you want to change?
      </label>
      <textarea
        id="specter-request"
        className="specter-request"
        value={userRequest}
        onChange={e => onUserRequestChange(e.target.value)}
        placeholder="e.g. make this button green and move it left of the title"
        rows={3}
      />

      <div className="specter-actions">
        <button
          type="button"
          className={cx('specter-btn', 'is-primary')}
          onClick={onSendToAgent}
          disabled={!userRequest.trim() || needsGuardAnswer}
          title={needsGuardAnswer ? 'Answer instance vs everywhere first' : `Send the instruction to ${agentLabel}`}>
          Send to {agentLabel}
        </button>
        <button type="button" className="specter-btn" onClick={onCopyTicket} title="Copy element context for a ticket">
          Copy for ticket
        </button>
      </div>

      {createTicketFn && (
        <div className="specter-ticket-row">
          <input
            type="text"
            className="specter-ticket-title"
            value={ticketTitle}
            onChange={e => onTicketTitleChange(e.target.value)}
            placeholder="Ticket title"
            aria-label="Ticket title"
          />
          <button
            type="button"
            className="specter-ticket-btn"
            onClick={onCreateTicket}
            disabled={!ticketTitle.trim() || isCreatingTicket}
            title={ticketTitle.trim() ? 'Create a ticket from this selection' : 'Type a ticket title first'}>
            {isCreatingTicket ? 'Creating…' : 'Create ticket'}
          </button>
        </div>
      )}

      {feedback && <p className="specter-feedback">{feedback}</p>}
      {createdTicket && (
        <p className="specter-feedback">
          Ticket {createdTicket.id} created ✓ —{' '}
          <a className="specter-feedback-link" href={createdTicket.url} target="_blank" rel="noreferrer">
            open ticket
          </a>
        </p>
      )}
    </aside>
  );
}
