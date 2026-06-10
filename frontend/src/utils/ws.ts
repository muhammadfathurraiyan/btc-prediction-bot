/** Drop handlers and close only if already open — avoids "closed before connection is established". */
export function disposeWebSocket(ws: WebSocket | null): void {
  if (!ws) return;
  ws.onopen = null;
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;
  if (ws.readyState === WebSocket.OPEN) {
    ws.close(1000, "client dispose");
  }
}
