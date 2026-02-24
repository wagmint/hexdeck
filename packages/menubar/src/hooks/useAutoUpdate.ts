import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export function useAutoUpdate() {
  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const update = await check();
        if (cancelled || !update) return;

        await update.downloadAndInstall();
        if (!cancelled) {
          await relaunch();
        }
      } catch (e) {
        console.warn("Auto-update failed:", e);
      }
    }

    checkForUpdate();

    return () => {
      cancelled = true;
    };
  }, []);
}
