import type { Platform } from "../../lib/types";
import PlatformStatusCard, {
  type PlatformRunStatus,
} from "./PlatformStatusCard";

type Props = {
  platforms: Platform[];
  statuses: Partial<Record<Platform, PlatformRunStatus>>;
};

export default function LoadingState({ platforms, statuses }: Props) {
  return (
    <div className="loading-state">
      <div className="loading-state__headline">
        <span className="spinner" aria-hidden="true" />
        <span>Comparing quotes across platforms…</span>
      </div>
      <div className="loading-state__grid">
        {platforms.map((p) => (
          <PlatformStatusCard
            key={p}
            platform={p}
            status={statuses[p] ?? "queued"}
          />
        ))}
      </div>
    </div>
  );
}
