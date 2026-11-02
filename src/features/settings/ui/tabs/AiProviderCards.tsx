import type { ReactNode } from "react";
import {
  SiGooglegemini,
  SiDeepseek,
  SiGoogletranslate,
  SiAnthropic,
  SiOpenrouter,
  SiOllama,
} from "react-icons/si";
import { TbBrandOpenai } from "react-icons/tb";
import { LuServer, LuCheck } from "react-icons/lu";
import type { AiProvider } from "@/features/ai-translate";

interface ProviderItem {
  id: AiProvider;
  name: string;
  badge?: string;
  subtitle: string;
  icon: ReactNode;
}

const PROVIDERS: ProviderItem[] = [
  {
    id: "gemini",
    name: "Gemini",
    badge: "Recommended",
    subtitle: "Google Gemini 2.0",
    icon: <SiGooglegemini className="w-5 h-5 text-[#8ab4f8]" />,
  },
  {
    id: "claude",
    name: "Claude",
    subtitle: "Anthropic 3.5 Haiku",
    icon: <SiAnthropic className="w-5 h-5 text-[#d97757]" />,
  },
  {
    id: "openai",
    name: "OpenAI",
    subtitle: "GPT-4o / o3-mini",
    icon: <TbBrandOpenai className="w-5 h-5 text-[#10a37f]" />,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    subtitle: "V3 / R1 Reasoner",
    icon: <SiDeepseek className="w-5 h-5 text-[#0066ff]" />,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    subtitle: "Unified AI Gateway",
    icon: <SiOpenrouter className="w-5 h-5 text-[#818cf8]" />,
  },
  {
    id: "ollama",
    name: "Ollama",
    subtitle: "Local & Offline AI",
    icon: <SiOllama className="w-5 h-5 text-white" />,
  },
  {
    id: "openai_compatible",
    name: "Compatible",
    subtitle: "Custom API / Proxy",
    icon: <LuServer className="w-5 h-5 text-[#a78bfa]" />,
  },
  {
    id: "google_translate",
    name: "Free",
    subtitle: "No API key needed",
    icon: <SiGoogletranslate className="w-5 h-5 text-[#4285f4]" />,
  },
];

interface AiProviderCardsProps {
  value: AiProvider;
  onChange: (provider: AiProvider) => void;
}

export function AiProviderCards({ value, onChange }: AiProviderCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 w-full">
      {PROVIDERS.map((item) => {
        const isSelected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(item.id)}
            className={`group relative flex flex-col justify-between min-h-[105px] p-3 rounded-xl border text-left transition-all cursor-pointer select-none ${
              isSelected
                ? "bg-white/10 border-white/40 ring-1 ring-white/30 shadow-md"
                : "bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-white/20 text-white/70"
            }`}
          >
            {isSelected && (
              <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center shadow">
                <LuCheck className="w-2.5 h-2.5 stroke-[3]" />
              </div>
            )}

            <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center mb-2">
              {item.icon}
            </div>

            <div className="flex flex-col mt-auto">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-white tracking-tight">{item.name}</span>
                {item.badge && (
                  <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-500/25">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-white/50 group-hover:text-white/70 line-clamp-1 mt-0.5">
                {item.subtitle}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
