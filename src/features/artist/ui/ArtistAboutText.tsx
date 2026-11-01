import { useTranslation } from "@/languages";

interface ArtistAboutTextProps {
  description: string;
  onShowAll: () => void;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/(Дискография)(Официальный)/g, "$1\n\n$2")
    .replace(
      /(сайт|ВКонтакте|канал|#\d|TikTok)(Официальный|Сообщество|Страница|Телеграм|YouTube|TikTok|Twitch)/g,
      "$1, $2",
    )
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^•\s*/gm, "")
    .trim();
}

export default function ArtistAboutText({
  description,
  onShowAll,
}: ArtistAboutTextProps) {
  const { t } = useTranslation();
  return (
    <div className="mt-[6px] flex max-w-[560px] flex-col items-start gap-[2px]">
      <p className="m-0 line-clamp-2 text-[13px] leading-[1.5] font-[400] text-text-secondary select-text">
        {stripMarkdown(description)}
      </p>
      {description.length > 120 && (
        <button
          type="button"
          onClick={onShowAll}
          className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-[500] text-text-tertiary transition-colors hover:text-text-primary"
        >
          {t("artist.show_all")}
        </button>
      )}
    </div>
  );
}
