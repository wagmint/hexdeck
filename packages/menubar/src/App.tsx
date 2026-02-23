import { usePylonSSE } from "./hooks/usePylonSSE";
import { useAlerts } from "./hooks/useAlerts";
import { MenuBarApp } from "./components/MenuBarApp";

export default function App() {
  const { state, loading, error, connected } = usePylonSSE();
  const { alerts, severity } = useAlerts(state, connected);

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
