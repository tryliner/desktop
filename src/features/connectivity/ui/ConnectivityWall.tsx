import { useMemo, useState } from "react";
import { WifiOffLine, CopyLine, DownloadLine, MailLine } from "@mingcute/react";
import Button from "@/shared/ui/Button";
import { useTranslation } from "@/languages";
import { useToast } from "@/shared/ui";
import { useConnectivityStore } from "../store/connectivityStore";
import type { DiagCheck } from "../lib/diagnostics";
import { DIAG_ENDPOINTS } from "../lib/diagnostics";
import { buildOfflineDump, copyDump, downloadDump } from "../lib/dump";

const SUPPORT_MAIL = "dev@tryliner.fun";

function StatusDot({ status }: { status: DiagCheck["status"] }) {
  const color =
    status === "ok"
      ? "bg-emerald-400"
      : status === "fail"
        ? "bg-red-400"
        : "bg-text-tertiary";
  return <span className={`mt-[5px] h-[8px] w-[8px] shrink-0 rounded-full ${color}`} />;
}

// full-screen offline wall, blocks the whole app until the backend is back.
export default function ConnectivityWall() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showChecks, setShowChecks] = useState(false);
  const visible = useConnectivityStore((s) => s.visible);
  const running = useConnectivityStore((s) => s.running);
  const checks = useConnectivityStore((s) => s.checks);
  const failures = useConnectivityStore((s) => s.failures);
  const main = useConnectivityStore((s) => s.main);
  const lastRunAt = useConnectivityStore((s) => s.lastRunAt);
  const retry = useConnectivityStore((s) => s.retry);
  const runDiagnostics = useConnectivityStore((s) => s.runDiagnostics);

  const dump = useMemo(
    () =>
      buildOfflineDump({
        checks,
        failures,
        main,
        endpoints: DIAG_ENDPOINTS,
      }),
    [checks, failures, main],
  );

  if (!visible) return null;

  const okCount = checks.filter((c) => c.status === "ok").length;
  const steps = [
    t("connectivity.step_net"),
    t("connectivity.step_vpn"),
    t("connectivity.step_firewall"),
    t("connectivity.step_router"),
  ];

  const checkLabel = (check: DiagCheck): string => {
    const base = t(`connectivity.check_${check.id}`);
    return check.host ? `${base} · ${check.host}` : base;
  };

  const handleCopy = async () => {
    const done = await copyDump(dump);
    toast(
      done ? t("connectivity.dump_copied") : t("connectivity.dump_copy_failed"),
      done ? "info" : "error",
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-primary/95 p-[24px] backdrop-blur-md">
      <div className="flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-lg border border-bg-elevated bg-bg-panel p-[28px]">
        <div className="flex items-center gap-[12px]">
          <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
            <WifiOffLine size={20} />
          </span>
          <div className="min-w-0">
            <h1
              className="m-0 text-[18px] font-[600] tracking-[-0.01em] text-text-primary"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {t("connectivity.wall_title")}
            </h1>
            <p
              className="m-0 mt-[2px] text-[13px] text-text-secondary"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {t("connectivity.wall_subtitle")}
            </p>
          </div>
        </div>

        <div className="mt-[16px] min-h-0 flex-1 overflow-y-auto">
          <p
            className="m-0 text-[13px] font-[600] text-text-primary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {t("connectivity.steps_title")}
          </p>
          <ol
            className="m-0 mt-[8px] flex flex-col gap-[6px] pl-[20px] text-[13px] leading-[1.5] text-text-secondary"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {steps.map((step) => (
              <li key={step} className="m-0">
                {step}
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => {
              setShowChecks((prev) => !prev);
              if (checks.length === 0) void runDiagnostics();
            }}
            className="mt-[16px] w-full rounded-md bg-bg-elevated px-[12px] py-[10px] text-left text-[13px] font-[500] text-text-primary transition-colors hover:bg-bg-panel cursor-pointer border-0"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {checks.length > 0
              ? t("connectivity.check_ok_count", { ok: okCount, total: checks.length })
              : t("connectivity.checks_title")}
            {lastRunAt
              ? ` · ${new Date(lastRunAt).toLocaleTimeString()}`
              : ` · ${t("connectivity.never_run")}`}
          </button>

          {showChecks ? (
            <div className="mt-[8px] flex flex-col gap-[4px] rounded-md bg-bg-elevated/60 p-[10px]">
              {running && checks.length === 0 ? (
                <p
                  className="m-0 px-[2px] py-[4px] text-[12px] text-text-tertiary"
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                >
                  {t("connectivity.retrying")}
                </p>
              ) : null}
              {checks.map((check, idx) => (
                <div key={`${check.id}-${check.host ?? ""}-${idx}`} className="flex items-start gap-[8px] px-[2px] py-[3px]">
                  <StatusDot status={check.status} />
                  <div className="min-w-0 flex-1">
                    <p
                      className="m-0 text-[12px] font-[500] text-text-primary"
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {checkLabel(check)}
                      {typeof check.latencyMs === "number" ? (
                        <span className="font-[400] text-text-tertiary"> · {check.latencyMs}ms</span>
                      ) : null}
                    </p>
                    {check.detail ? (
                      <p
                        className="m-0 truncate text-[11px] text-text-tertiary"
                        title={check.detail}
                        style={{ fontFamily: "var(--font-inter), sans-serif" }}
                      >
                        {check.detail}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="shrink-0 text-[11px] text-text-tertiary"
                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                  >
                    {t(`connectivity.status_${check.status}`)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-[18px] flex flex-wrap items-center gap-[8px]">
          <Button
            variant="primary"
            onClick={() => void retry()}
            disabled={running}
            className="!h-[38px] px-[20px] !text-[13px]"
          >
            {running ? t("connectivity.retrying") : t("connectivity.retry")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleCopy()}
            className="!h-[38px] px-[14px] !text-[13px] flex items-center gap-[6px]"
          >
            <CopyLine size={15} />
            {t("connectivity.copy_dump")}
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadDump(dump)}
            className="!h-[38px] px-[14px] !text-[13px] flex items-center gap-[6px]"
          >
            <DownloadLine size={15} />
            {t("connectivity.download_dump")}
          </Button>
          <a
            href={`mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent("Liner connection problem")}`}
            className="inline-flex h-[38px] items-center gap-[6px] px-[8px] text-[13px] font-[500] text-text-secondary hover:text-text-primary transition-colors"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            <MailLine size={15} />
            {t("connectivity.support")}
          </a>
        </div>
        <p
          className="m-0 mt-[10px] text-[12px] text-text-tertiary"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {t("connectivity.support_hint")}
        </p>
      </div>
    </div>
  );
}
