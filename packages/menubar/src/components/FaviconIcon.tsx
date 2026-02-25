import type { TraySeverity } from "../lib/alerts";
import { GlowHex } from "./GlowHex";

interface FaviconIconProps {
  severity: TraySeverity;
}

export function FaviconIcon({ severity }: FaviconIconProps) {
  return (
    <div className="w-12 h-12 flex items-center justify-center cursor-pointer">
      <GlowHex severity={severity} size={9} className="hover:scale-110 transition-transform" />
    </div>
  );
}
