export const WS_ENDPOINT = (import.meta.env.VITE_WS_ENDPOINT as string | undefined)
  ?? 'wss://ecleevh82h.execute-api.us-west-2.amazonaws.com/prod';
export const CALLSIGN_REGEX = /^[a-zA-Z0-9_]{1,20}$/;
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_RETRY_ATTEMPTS = 5;
