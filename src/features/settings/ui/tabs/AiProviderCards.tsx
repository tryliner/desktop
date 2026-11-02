import type { ReactNode } from "react";
import { SiGooglegemini, SiDeepseek, SiGoogletranslate } from "react-icons/si";
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
    id: "openai_compatible",
    name: "Compatible",
    subtitle: "Custom API / Local",
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 w-full">
      {PROVIDERS.map((item) => {
        const isSelected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(item.id)}
            className={`group relative flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer select-none ${
              isSelected
                ? "bg-white/10 border-white/40 ring-1 ring-white/30 shadow-md"
                : "bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-white/20 text-white/70"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
                {item.icon}
              </div>
              {isSelected ? (
                <div className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center">
                  <LuCheck className="w-2.5 h-2.5" />
                </div>
              ) : item.badge ? (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                  {item.badge}
                </span>
              ) : null}
            </div>

            <span className="text-xs font-semibold text-white tracking-tight">{item.name}</span>
            <span className="text-[11px] text-white/50 group-hover:text-white/70 line-clamp-1 mt-0.5">
              {item.subtitle}
            </span>
          </button>
        );
      })}
    </div>
  );
}
