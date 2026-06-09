export interface MountedDevice {
  /** Absolute mount path (e.g. "E:\\" on Windows, "/Volumes/SDCARD" on macOS) */
  mountPath: string;
  /** Filesystem label, when known */
  label?: string;
  /** Drive type as reported by OS (Removable, Fixed, Network, etc.) */
  driveType?: string;
  /** Total size in bytes, if known */
  sizeBytes?: number;
  /** Free space in bytes, if known */
  freeBytes?: number;
}

/** Identifies a specific physical device across mounts via a marker file at the device root. */
export interface DeviceIdentity {
  /** Stable UUID written into the marker file on first registration */
  id: string;
  /** Friendly nickname chosen by the user (e.g. "RG35XX SD card") */
  nickname: string;
  /** Last mount path we saw this device at (informational only) */
  lastMountPath?: string;
  /** ISO timestamp the marker was written */
  registeredAt: string;
  /** Forward-slash path, relative to the mount root, of the RetroArch
      `playlists/logs` directory containing per-core `.lrtl` files. When set,
      the activity feature scans this directory for playtime data. */
  retroarchActivityDir?: string;
}

/** One of the two device slots inside a profile. */
export interface ProfileSlot {
  /** Which device is bound to this slot, by stable id */
  deviceId: string;
  /** Path of the save file (or destination directory when isDirectory is true),
      relative to the device root, using forward slashes */
  fileRelPath: string;
  /** When true, fileRelPath points at a directory and the actual filename is
      derived from the *other* slot at transfer time. Used to seed a device
      that doesn't have the save yet. */
  isDirectory?: boolean;
}

export interface Profile {
  name: string;
  /** Free-form notes (e.g. "Pokemon Emerald — RG35XX <-> RetroArch on PC") */
  notes?: string;
  slotA?: ProfileSlot;
  slotB?: ProfileSlot;
  createdAt: string;
  updatedAt: string;
}

/** A user-configured folder treated as if it were a mounted device.
   Useful for testing without hardware, or for syncing to a network share folder. */
export interface VirtualMount {
  /** Absolute path to the folder on the host filesystem */
  path: string;
  /** Optional friendly label shown in the UI */
  label?: string;
  /** ISO timestamp this entry was added */
  addedAt: string;
  /** Forward-slash path, relative to this mount, of the RetroArch
      `playlists/logs` directory containing per-core `.lrtl` files. */
  retroarchActivityDir?: string;
}

export interface ConfigFile {
  version: 1;
  devices: DeviceIdentity[];
  profiles: Profile[];
  virtualMounts: VirtualMount[];
}

export type SlotKey = "slotA" | "slotB";

export const MARKER_FILENAME = ".savesmanager-device-id.json";
