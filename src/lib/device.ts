export type DeviceSignals = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  mobileHint?: boolean;
};

// Viewport width and touch support alone also match desktop computers.
// iPadOS can identify itself as a Mac when requesting desktop websites.
export function supportsMobileRun(device: DeviceSignals): boolean {
  if (device.maxTouchPoints < 2) return false;
  const ipadDesktopMode = device.platform === 'MacIntel' && device.maxTouchPoints > 1;
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(device.userAgent);
  return device.mobileHint === true || mobileAgent || ipadDesktopMode;
}
