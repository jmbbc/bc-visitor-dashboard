function doPost(e) {
  let reply;
  try {
    const { requestId, entry } = JSON.parse(e.parameter.payload);
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if (typeof requestId !== 'string' || !uuid.test(requestId) ||
        typeof entry?.id !== 'string' || !uuid.test(entry.id)) {
      throw new Error('Invalid request');
    }
    reply = { type: 'counter-save', requestId, id: entry.id, ok: false };
    const result = submitCounterEntry(entry);
    reply.ok = result.id === entry.id;
  } catch (_) {
    // Return an unconfirmed result without exposing storage errors.
  }
  const message = JSON.stringify(reply || null).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<script>window.top.postMessage(' + message + ', "https://jmbbc.github.io");</script>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
