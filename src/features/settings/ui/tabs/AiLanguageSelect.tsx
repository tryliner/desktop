import { useState, useRef, useEffect } from "react";
import { LuChevronDown, LuCheck, LuSearch } from "react-icons/lu";
import { TARGET_LANG_OPTIONS, type LanguageOption } from "./AiLanguages";

interface AiLanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function AiLanguageSelect({ value, onChange }: AiLanguageSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = TARGET_LANG_OPTIONS.find((l) => l.value === value) ?? {
    value,
    label: value.toUpperCase(),
    native: value,
  };

  const filtered = TARGET_LANG_OPTIONS.filter(
    (l) =>
      l.label.toLowerCase().includes(search.toLowerCase()) ||
      l.native.toLowerCase().includes(search.toLowerCase()) ||
      l.value.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      inputRef.current?.focus();
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (lang: LanguageOption) => {
    onChange(lang.value);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative select-none">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex min-w-[190px] items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-sm font-medium text-white transition-colors cursor-pointer shadow-sm"
      >
        <span className="flex items-center gap-1.5 truncate">
          <span className="font-semibold text-white">{selected.native}</span>
          <span className="text-xs text-white/50 font-normal">({selected.label})</span>
        </span>
        <LuChevronDown
          className={`w-4 h-4 text-white/60 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-64 max-h-72 rounded-xl bg-[#16161a] border border-white/15 shadow-2xl p-1.5 z-50 flex flex-col backdrop-blur-xl">
          <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1 bg-white/5 rounded-lg border border-white/10">
            <LuSearch className="w-3.5 h-3.5 text-white/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search language..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>

          <div role="listbox" className="overflow-y-auto max-h-52 flex flex-col gap-0.5 pr-0.5">
            {filtered.length === 0 ? (
              <div className="text-center py-4 text-xs text-white/40">No language found</div>
            ) : (
              filtered.map((lang) => {
                const isCurrent = lang.value === value;
                return (
                  <button
                    key={lang.value}
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    onClick={() => handleSelect(lang)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                      isCurrent
                        ? "bg-white/15 text-white font-medium shadow-sm"
                        : "hover:bg-white/10 text-white/70 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="font-medium text-white">{lang.native}</span>
                      <span className="text-[11px] text-white/40">· {lang.label}</span>
                    </span>
                    {isCurrent && <LuCheck className="w-3.5 h-3.5 text-white shrink-0 ml-1.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
