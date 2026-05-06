import type { Platform } from "../../lib/types";
import { platformLabel } from "../../lib/platformLinks";

export type PlatformRunStatus =
  | "queued"
  | "running"
  | "success"
  | "partial"
  | "failed";

type Props = {
  platform: Platform;
  status: PlatformRunStatus;
  message?: string;
};

const STATUS_LABEL: Record<PlatformRunStatus, string> = {
  queued: "Waiting",
  running: "Scraping…",
  success: "Done",
  partial: "Partial",
  failed: "Failed",
};

export default function PlatformStatusCard({
  platform,
  status,
  message,
}: Props) {
  return (
    <div className={`platform-status platform-status--${status}`}>
      <div className="platform-status__row">
        <span className="platform-status__name">{platformLabel(platform)}</span>
        <span className="platform-status__state">{STATUS_LABEL[status]}</span>
      </div>
      {message ? (
        <div className="platform-status__message">{message}</div>
      ) : null}
    </div>
  );
}
