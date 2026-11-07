import { MenuSelect } from "@/shared/ui";
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
    <aside className="relative flex min-h-[140px] md:min-h-[340px] flex-col overflow-hidden rounded-[14px] bg-black/[0.03] p-[16px] md:p-[24px] dark:bg-white/[0.035]">
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

      <div className="relative flex items-center justify-between gap-[10px]">
        <div className="flex items-center gap-[10px]">
          <img
            src={logo}
            alt="Liner"
            width={45}
            height={35}
            draggable={false}
            className="theme-logo h-[22px] w-auto object-contain select-none"
          />
          <span className="text-heading font-[650] tracking-[-0.03em] text-text-primary">
            Liner
          </span>
        </div>
        <div className="md:hidden">
          <MenuSelect
            options={LOCALE_OPTIONS}
            value={locale}
            onChange={setLocale}
            align="end"
            className="min-w-[110px]"
            aria-label={t("login.select_language")}
          />
        </div>
      </div>

      <div className="relative mt-auto flex flex-col pt-3 md:pt-0">
        <div className="mb-[22px] hidden md:block w-fit">
          <MenuSelect
            options={LOCALE_OPTIONS}
            value={locale}
            onChange={setLocale}
            align="start"
            className="min-w-[132px]"
            aria-label={t("login.select_language")}
          />
        </div>
        <h1
          className="m-0 text-[20px] md:text-[30px] font-[700] leading-[1.15] tracking-[-0.035em] text-text-primary"
          style={{ textWrap: "balance" }}
        >
          {title}
        </h1>
        <p
          className="m-0 mt-[6px] md:mt-[10px] max-w-full md:max-w-[240px] text-[12px] md:text-[13.5px] leading-[1.45] text-text-secondary"
          style={{ textWrap: "pretty" }}
        >
          {subtitle}
        </p>
      </div>
    </aside>
  );
}

export default LoginBrandPanel;
