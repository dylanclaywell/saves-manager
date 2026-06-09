import type { ConfigFile, DeviceIdentity, Profile, ProfileSlot, SlotKey } from "./types";

export function findProfile(cfg: ConfigFile, name: string): Profile | undefined {
  return cfg.profiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

export function upsertProfile(cfg: ConfigFile, profile: Profile): void {
  const idx = cfg.profiles.findIndex(
    (p) => p.name.toLowerCase() === profile.name.toLowerCase(),
  );
  if (idx >= 0) cfg.profiles[idx] = profile;
  else cfg.profiles.push(profile);
}

export function deleteProfile(cfg: ConfigFile, name: string): boolean {
  const before = cfg.profiles.length;
  cfg.profiles = cfg.profiles.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
  return cfg.profiles.length < before;
}

export function getSlot(profile: Profile, slot: SlotKey): ProfileSlot | undefined {
  return profile[slot];
}

export function setSlot(profile: Profile, slot: SlotKey, value: ProfileSlot | undefined): void {
  profile[slot] = value;
  profile.updatedAt = new Date().toISOString();
}

export function newProfile(name: string, notes?: string): Profile {
  const now = new Date().toISOString();
  return { name, notes, createdAt: now, updatedAt: now };
}

export function findDevice(cfg: ConfigFile, deviceId: string): DeviceIdentity | undefined {
  return cfg.devices.find((d) => d.id === deviceId);
}

export function upsertDevice(cfg: ConfigFile, device: DeviceIdentity): void {
  const idx = cfg.devices.findIndex((d) => d.id === device.id);
  if (idx >= 0) cfg.devices[idx] = device;
  else cfg.devices.push(device);
}

export function profileIsReady(p: Profile): boolean {
  return Boolean(p.slotA && p.slotB);
}

export function profileSummary(p: Profile, cfg: ConfigFile): string {
  const a = describeSlot(p.slotA, cfg);
  const b = describeSlot(p.slotB, cfg);
  return `${a}  ⇄  ${b}`;
}

function describeSlot(slot: ProfileSlot | undefined, cfg: ConfigFile): string {
  if (!slot) return "[empty]";
  const dev = findDevice(cfg, slot.deviceId);
  const devName = dev?.nickname ?? "(unknown device)";
  return `${devName}:${slot.fileRelPath}`;
}
