import { platform } from "node:os";
import { devMode, isVirtualMountManagementEnabled } from "../utils/runtime";
import { BACKUP_DIR, CONFIG_DIR, CONFIG_PATH } from "../utils/storage";

export default defineEventHandler(() => {
  return {
    configPath: CONFIG_PATH,
    configDir: CONFIG_DIR,
    backupDir: BACKUP_DIR,
    platform: platform(),
    isDev: devMode(),
    virtualMountManagementEnabled: isVirtualMountManagementEnabled(),
  };
});
