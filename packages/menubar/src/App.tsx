import { getCurrentWindow } from "@tauri-apps/api/window";
import { usePylonSSE } from "./hooks/usePylonSSE";
import { useAlerts } from "./hooks/useAlerts";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import { MenuBarApp } from "./components/MenuBarApp";
import { WidgetApp } from "./components/WidgetApp";

const isWidget = getCurrentWindow().label === "widget";

export default function App() {
  useAutoUpdate();
  const { state, loading, error, connected } = usePylonSSE();
  const { alerts, severity } = useAlerts(state, connected);

  if (isWidget) {
    return (
      <WidgetApp
        severity={severity}
        state={state}
        alerts={alerts}
        connected={connected}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <MenuBarApp
      state={state}
      alerts={alerts}
      severity={severity}
      connected={connected}
      loading={loading}
      error={error}
    />
  );
}
