// Only used in isolated test processes/threads, never in the browser app.
export function removeRecentFeatures() {
  const features: [object, string][] = [
    [Promise, 'withResolvers'], [Promise, 'try'],
    [ArrayBuffer.prototype, 'transfer'], [ArrayBuffer.prototype, 'transferToFixedLength'],
    [Uint8Array, 'fromBase64'], [Uint8Array, 'fromHex'],
    [Uint8Array.prototype, 'toBase64'], [Uint8Array.prototype, 'toHex'],
    [Uint8Array.prototype, 'setFromBase64'], [Uint8Array.prototype, 'setFromHex'],
    [Math, 'sumPrecise'],
  ];
  for (const [owner, name] of features) {
    if (!Reflect.deleteProperty(owner, name)) throw new Error(`Cannot simulate missing ${name}`);
  }
}
