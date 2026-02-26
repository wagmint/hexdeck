import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";

const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT = 100;
const FAVICON_SIZE = 48;
const AUTO_DISMISS_DELAY = 8000;
const STARTUP_DELAY = 600;
const VIEWPORT_SETTLE_DELAY = 50;
const EXPAND_RETRY_DELAY = 150;
const EXPAND_RETRY_COUNT = 8;

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function expandForTooltip(): Promise<void> {
  const win = getCurrentWindow();
  const scale = window.devicePixelRatio || 1;
  const pos = await win.outerPosition();
  const size = await win.outerSize();

  const newPhysWidth = TOOLTIP_WIDTH * scale;
  const newPhysHeight = TOOLTIP_HEIGHT * scale;
  const widthDelta = newPhysWidth - size.width;
  const heightDelta = newPhysHeight - size.height;

  await win.setSize(new LogicalSize(TOOLTIP_WIDTH, TOOLTIP_HEIGHT));

  // Anchor right edge (favicon stays put), center vertically
  let newX = pos.x - widthDelta;
  let newY = pos.y - Math.round(heightDelta / 2);

  const monitor = await currentMonitor();
  if (monitor) {
    const pad = 8 * scale;
    const monX = monitor.position.x;
    const monY = monitor.position.y;
    const monW = monitor.size.width;
    const monH = monitor.size.height;
    if (newX + newPhysWidth > monX + monW - pad) newX = monX + monW - newPhysWidth - pad;
    if (newX < monX + pad) newX = monX + pad;
    if (newY + newPhysHeight > monY + monH - pad) newY = monY + monH - newPhysHeight - pad;
    if (newY < monY) newY = monY;
  }

  await win.setPosition(new PhysicalPosition(newX, newY));
}

async function collapseToFavicon(): Promise<void> {
  const win = getCurrentWindow();
  const scale = window.devicePixelRatio || 1;
  const pos = await win.outerPosition();
  const size = await win.outerSize();

  const newPhysWidth = FAVICON_SIZE * scale;
  const widthDelta = newPhysWidth - size.width;
  const heightDelta = FAVICON_SIZE * scale - size.height;

  await win.setSize(new LogicalSize(FAVICON_SIZE, FAVICON_SIZE));
  const newX = pos.x - widthDelta;
  const newY = pos.y - Math.round(heightDelta / 2);
  await win.setPosition(new PhysicalPosition(newX, newY));
}

export function useFirstLaunchTooltip() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [blockWidgetInteractions, setBlockWidgetInteractions] = useState(true);
  const dismissedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (cancelled) return;

        // Let position-loading settle first
        await sleep(STARTUP_DELAY);
        if (cancelled) return;

        let expanded = false;
        for (let i = 0; i < EXPAND_RETRY_COUNT; i += 1) {
          try {
            await expandForTooltip();
            expanded = true;
            break;
          } catch {
            if (i < EXPAND_RETRY_COUNT - 1) {
              await sleep(EXPAND_RETRY_DELAY);
            }
          }
          if (cancelled) return;
        }

        if (!expanded) {
          setBlockWidgetInteractions(false);
          return;
        }

        // Brief pause so the webview viewport catches up after resize
        await sleep(VIEWPORT_SETTLE_DELAY);
        if (cancelled) return;

        setShowTooltip(true);
      } catch (err) {
        console.error("[tooltip]", err);
        if (!cancelled) {
          setBlockWidgetInteractions(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!showTooltip) return;
    const t = setTimeout(() => dismiss(), AUTO_DISMISS_DELAY);
    return () => clearTimeout(t);
  }, [showTooltip]);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setShowTooltip(false);
    setBlockWidgetInteractions(false);

    (async () => {
      try {
        await collapseToFavicon();
        try {
          await invoke("save_has_seen_tooltip");
        } catch {}
      } catch {}
    })();
  }, []);

  return { showTooltip, blockWidgetInteractions, dismiss };
}
