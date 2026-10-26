import Select from "@/shared/ui/Select";
import { useTranslation, LOCALE_OPTIONS } from "@/languages";
import logo from "@/assets/logo.svg";
import loginMark from "@/assets/login-mark.svg";

export interface LoginBrandPanelProps {
  title: string;
  subtitle: string;
}

export function LoginBrandPanel({ title, subtitle }: LoginBrandPanelProps) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <aside className="relative flex min-h-[340px] flex-col overflow-hidden rounded-[14px] bg-black/[0.03] p-[24px] dark:bg-white/[0.035]">
      <img
        src={loginMark}
        alt=""
        aria-hidden="true"
        width={435}
        height={598}
        draggable={false}
        className="theme-logo pointer-events-none absolute inset-x-0 top-0 h-auto w-full select-none mask-b-from-40% mask-b-to-100%"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-linear-to-t from-transparent to-transparent dark:from-black/25" />

      <div className="relative flex items-center gap-[10px]">
        <img
          src={logo}
          alt="Liner"
          width={45}
          height={35}
          draggable={false}
          className="theme-logo h-[22px] w-auto object-contain select-none"
        />
        <span className="text-[18px] font-[650] tracking-[-0.03em] text-text-primary">
          Liner
        </span>
      </div>

      <div className="relative mt-auto flex flex-col">
        <Select
          options={LOCALE_OPTIONS}
          value={locale}
          onChange={setLocale}
          align="bottom-left"
          variant="transparent"
          className="mb-[22px] w-fit min-w-[132px]"
          aria-label={t("login.select_language")}
        />
        <h1
          className="m-0 text-[30px] font-[700] leading-[1.08] tracking-[-0.035em] text-text-primary"
          style={{ textWrap: "balance" }}
        >
          {title}
        </h1>
        <p
          className="m-0 mt-[10px] max-w-[240px] text-[13.5px] leading-[1.5] text-text-secondary"
          style={{ textWrap: "pretty" }}
        >
          {subtitle}
        </p>
      </div>
    </aside>
  );
}

export default LoginBrandPanel;
