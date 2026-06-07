/**
 * react-specter — shared constants.
 *
 * The data attributes are the contract between the build-time annotation
 * (babel/vite/webpack adapters) and the runtime overlay: the transform stamps
 * them onto host JSX elements, the overlay reads them off clicked DOM nodes.
 */
export const FILE_ATTR = 'data-specter-file';
export const LINE_ATTR = 'data-specter-line';
export const COMPONENT_ATTR = 'data-specter-component';

export const ROOT_ID = 'specter-root';
export const STYLE_TAG_ID = 'specter-styles';

export const DEFAULT_BRIDGE_PORT = 7331;
export const DEFAULT_BRIDGE_URL = `http://127.0.0.1:${DEFAULT_BRIDGE_PORT}/pending-edit`;
