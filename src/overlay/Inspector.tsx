/**
 * react-specter overlay — top-level inspector: composes the floating toggle,
 * the hover outline, and the selection panel from the hook's state machine.
 */
import FloatingToggle from './FloatingToggle';
import HoverOutline from './HoverOutline';
import SelectionPanel from './SelectionPanel';
import useInspector from './useInspector';

export default function Inspector() {
  const {
    mode,
    toggle,
    reset,
    hoverAnchor,
    anchor,
    chain,
    chainIndex,
    setChainIndex,
    userRequest,
    setUserRequest,
    instanceCount,
    instanceVsShared,
    setInstanceVsShared,
    feedback,
    ticketTitle,
    setTicketTitle,
    isCreatingTicket,
    createdTicket,
    handleSendToAgent,
    handleCopyTicket,
    handleCreateTicket,
  } = useInspector();

  const outlineTarget = mode === 'selecting' ? hoverAnchor : mode === 'captured' ? anchor : null;

  return (
    <>
      <FloatingToggle active={mode !== 'idle'} onToggle={mode === 'captured' ? reset : toggle} />
      <HoverOutline target={outlineTarget} captured={mode === 'captured'} />
      {mode === 'captured' && anchor && (
        <SelectionPanel
          anchor={anchor}
          chain={chain}
          chainIndex={chainIndex}
          onChainIndexChange={setChainIndex}
          userRequest={userRequest}
          onUserRequestChange={setUserRequest}
          instanceCount={instanceCount}
          instanceVsShared={instanceVsShared}
          onInstanceVsSharedChange={setInstanceVsShared}
          feedback={feedback}
          onSendToAgent={handleSendToAgent}
          onCopyTicket={handleCopyTicket}
          ticketTitle={ticketTitle}
          onTicketTitleChange={setTicketTitle}
          onCreateTicket={handleCreateTicket}
          isCreatingTicket={isCreatingTicket}
          createdTicket={createdTicket}
          onClose={reset}
        />
      )}
    </>
  );
}
