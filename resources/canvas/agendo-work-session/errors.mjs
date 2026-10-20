/** Error with a stable code, independent of the Copilot SDK so the server can run in any host. */
export class CanvasError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CanvasError';
    this.code = code;
  }
}
