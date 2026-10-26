import type { TvDeviceCode } from "@/shared/youtube";
import { useTranslation } from "@/languages";
import ActivationCode from "./ActivationCode";
import QrTile from "./QrTile";

const ACTIVATE_URL = "https://yt.be/activate";
const ACTIVATE_LABEL = "yt.be/activate";

export interface ActivationPanelProps {
  code: TvDeviceCode | null;
}

function openExternal(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function ActivationPanel({ code }: ActivationPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="relative w-[160px] shrink-0 self-stretch">
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <QrTile value={code?.activationUrl ?? null} />
        <div className="mt-[14px] flex flex-col items-center gap-[7px]">
          <span className="text-[12px] leading-none text-text-tertiary">
            {t("youtube_auth.or_enter_code") || "or enter the code at"}
          </span>
          <a
            href={ACTIVATE_URL}
            onClick={(event) => {
              event.preventDefault();
              openExternal(ACTIVATE_URL);
            }}
            className="text-[13px] font-[500] leading-none text-text-primary underline decoration-text-tertiary underline-offset-[3px] hover:decoration-text-primary"
          >
            {ACTIVATE_LABEL}
          </a>
        </div>
        <div className="mt-[14px] w-full">
          <ActivationCode code={code?.userCode ?? null} />
        </div>
      </div>
    </div>
  );
}
