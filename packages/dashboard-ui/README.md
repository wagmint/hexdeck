# @pylon-dev/dashboard-ui

Shared React UI components and types for building the Pylon dashboard experience.

## Install

```bash
npm install @pylon-dev/dashboard-ui
```

Peer dependencies:

- `react` `^18 || ^19`
- `react-dom` `^18 || ^19`

## What this package provides

- Dashboard components (`TopBar`, `AgentCard`, `WorkstreamNode`, `FeedItem`, `PlanDetail`, `RiskPanel`, etc.)
- Shared dashboard data types (`DashboardState`, `Agent`, `Workstream`, `FeedEvent`, etc.)
- Operator context (`OperatorProvider`, `useOperators`)
- Tailwind preset (`@pylon-dev/dashboard-ui/tailwind-preset`)
- Utility helpers (`timeAgo`, `formatDuration`)

## Tailwind setup

Add the preset:

```ts
// tailwind.config.ts
import pylonPreset from "@pylon-dev/dashboard-ui/tailwind-preset";

export default {
  presets: [pylonPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@pylon-dev/dashboard-ui/dist/**/*.{js,mjs}",
  ],
};
```

## Theme variables

Components use CSS variables for theme tokens. Define them in your global stylesheet:

```css
:root {
  --dash-bg: #080b12;
  --dash-surface: #0f1320;
  --dash-surface-2: #141a2a;
  --dash-surface-3: #1a2236;
  --dash-border: #20283d;
  --dash-border-light: #2b3550;
  --dash-text: #d8dce7;
  --dash-text-dim: #9ba4bd;
  --dash-text-muted: #737d98;
  --dash-green: #00e87b;
  --dash-green-dim: #00e87b33;
  --dash-red: #ff4d6a;
  --dash-red-dim: #ff4d6a33;
  --dash-yellow: #ffc44d;
  --dash-yellow-dim: #ffc44d33;
  --dash-blue: #4d9fff;
  --dash-blue-dim: #4d9fff33;
  --dash-purple: #b88cff;
  --dash-purple-dim: #b88cff33;
}
```

## Basic usage

```tsx
import {
  OperatorProvider,
  TopBar,
  AgentCard,
  type DashboardState,
} from "@pylon-dev/dashboard-ui";

export function Dashboard({ state }: { state: DashboardState }) {
  return (
    <OperatorProvider operators={state.operators}>
      <TopBar summary={state.summary} operators={state.operators} />
      <div>
        {state.workstreams.map((ws) => (
          <AgentCard key={ws.projectId} workstream={ws} />
        ))}
      </div>
    </OperatorProvider>
  );
}
```

## Exports

Primary component exports:

- `TopBar`, `RelayPanel`, `PanelHeader`
- `AgentPip`, `OperatorTag`, `AgentCard`, `WorkstreamNode`
- `FeedItem`, `CollisionDetail`, `PlanDetail`, `RiskPanel`
- `ProgressBar`, `DeviationItem`

Other exports:

- `OperatorProvider`, `useOperators`
- `timeAgo`, `formatDuration`
- Dashboard and relay types from `@pylon-dev/dashboard-ui`
- Tailwind preset from `@pylon-dev/dashboard-ui/tailwind-preset`

