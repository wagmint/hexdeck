import { getCurrentWindow } from "@tauri-apps/api/window";
import { useHexcoreSSE } from "./hooks/useHexcoreSSE";
import { useAlerts } from "./hooks/useAlerts";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import { MenuBarApp } from "./components/MenuBarApp";
import { WidgetApp } from "./components/WidgetApp";
import { OnboardingWindow } from "./components/OnboardingWindow";

const windowLabel = getCurrentWindow().label;

export default function App() {
  if (windowLabel === "onboarding") {
    return <OnboardingWindow />;
  }

  return <MainApp />;
}

function MainApp() {
  useAutoUpdate();
  const { state, loading, error, connected } = useHexcoreSSE();
  const { alerts, severity } = useAlerts(state, connected);

  if (windowLabel === "widget") {
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
