/**
 * react-specter overlay — top-level inspector: the ◎ launcher (when the box
 * is hidden), the hover outline, and the floating prompt box.
 */
import FloatingToggle from './FloatingToggle';
import HoverOutline from './HoverOutline';
import PromptBox from './PromptBox';
import useInspector from './useInspector';

export default function Inspector() {
  const {
    panelOpen,
    selecting,
    openPanel,
    hidePanel,
    toggleInspect,
    clearSelection,
    hoverAnchor,
    anchor,
    chain,
    chainIndex,
    setChainIndex,
    userRequest,
    setUserRequest,
    images,
    addImages,
    removeImage,
    instanceCount,
    instanceVsShared,
    setInstanceVsShared,
    feedback,
    bridgeOnline,
    ticketTitle,
    setTicketTitle,
    isSending,
    isCreatingTicket,
    createdTicket,
    handleSendToAgent,
    handleCopyTicket,
    handleCreateTicket,
  } = useInspector();

  const outlineTarget = selecting ? hoverAnchor : panelOpen ? anchor : null;

  return (
    <>
      {!panelOpen && <FloatingToggle onOpen={openPanel} />}
      <HoverOutline target={outlineTarget} captured={!selecting && !!anchor} />
      <PromptBox
        open={panelOpen}
        selecting={selecting}
        anchor={anchor}
        chain={chain}
        chainIndex={chainIndex}
        onChainIndexChange={setChainIndex}
        userRequest={userRequest}
        onUserRequestChange={setUserRequest}
        images={images}
        onAddImages={addImages}
        onRemoveImage={removeImage}
        instanceCount={instanceCount}
        instanceVsShared={instanceVsShared}
        onInstanceVsSharedChange={setInstanceVsShared}
        feedback={feedback}
        bridgeOnline={bridgeOnline}
        isSending={isSending}
        onSendToAgent={handleSendToAgent}
        onCopyTicket={handleCopyTicket}
        ticketTitle={ticketTitle}
        onTicketTitleChange={setTicketTitle}
        onCreateTicket={handleCreateTicket}
        isCreatingTicket={isCreatingTicket}
        createdTicket={createdTicket}
        onToggleInspect={toggleInspect}
        onClearSelection={clearSelection}
        onHide={hidePanel}
      />
    </>
  );
}
