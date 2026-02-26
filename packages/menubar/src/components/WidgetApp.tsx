import type { TraySeverity, PylonAlert } from "../lib/alerts";
import type { DashboardState } from "../lib/types";
import { useWidgetState } from "../hooks/useWidgetState";
import { useFirstLaunchTooltip } from "../hooks/useFirstLaunchTooltip";
import { FloatingWidget } from "./FloatingWidget";

interface WidgetAppProps {
  severity: TraySeverity;
  state: DashboardState | null;
  alerts: PylonAlert[];
  connected: boolean;
  loading: boolean;
  error: string | null;
}

export function WidgetApp(props: WidgetAppProps) {
  const tooltip = useFirstLaunchTooltip();
  const widget = useWidgetState(tooltip.blockWidgetInteractions);

  return <FloatingWidget widget={widget} tooltip={tooltip} {...props} />;
}
