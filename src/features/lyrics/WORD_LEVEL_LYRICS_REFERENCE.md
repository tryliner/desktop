# Word-Level Lyrics Centered Animation Reference

This document preserves the exact mathematical and component implementation of the centered word-by-word lyrics ticker from the overlay/touchbar component for future use.

## 1. Syllable Grouping Algorithm

Groups syllables from synchronized lyrics into coherent word entities by inspecting inter-syllable spacing in the full line text:

```typescript
export interface GroupedSyllable {
  text: string;
  timeMs: number;
  endMs: number;
  globalIndex: number;
}

export interface GroupedWord {
  syllables: GroupedSyllable[];
}

export function groupSyllablesIntoWords(
  rawWords: TouchBarWordData[],
  lineText: string
): GroupedWord[] {
  if (!rawWords || rawWords.length === 0) return [];
  const words: GroupedWord[] = [];
  let currentGroup: GroupedSyllable[] = [];
  let charCursor = 0;

  for (let i = 0; i < rawWords.length; i++) {
    const w = rawWords[i];
    if (!w || !w.text) continue;

    const trimmed = w.text.trim();
    if (trimmed.length === 0) {
      if (currentGroup.length > 0) {
        words.push({ syllables: currentGroup });
        currentGroup = [];
      }
      continue;
    }

    const foundIdx = lineText ? lineText.indexOf(trimmed, charCursor) : -1;
    let isContinuation = false;

    if (currentGroup.length > 0) {
      const prevSyllable = currentGroup[currentGroup.length - 1];
      const prevEndsSpace = /\s$/.test(prevSyllable.text);
      const currStartsSpace = /^\s/.test(w.text);

      if (foundIdx >= 0) {
        const textBetween = lineText.slice(charCursor, foundIdx);
        const hasSpaceBetween = /\s/.test(textBetween);
        if (!hasSpaceBetween && !prevEndsSpace && !currStartsSpace) {
          isContinuation = true;
        }
      } else if (!prevEndsSpace && !currStartsSpace) {
        isContinuation = true;
      }
    }

    if (foundIdx >= 0) {
      charCursor = foundIdx + trimmed.length;
    }

    if (isContinuation) {
      currentGroup.push({
        text: trimmed,
        timeMs: w.timeMs,
        endMs: w.endMs,
        globalIndex: i,
      });
    } else {
      if (currentGroup.length > 0) {
        words.push({ syllables: currentGroup });
      }
      currentGroup = [
        {
          text: trimmed,
          timeMs: w.timeMs,
          endMs: w.endMs,
          globalIndex: i,
        },
      ];
    }
  }

  if (currentGroup.length > 0) {
    words.push({ syllables: currentGroup });
  }

  return words;
}
```

## 2. Active Word & Group Tracking

```typescript
const activeWordIndex = useMemo(() => {
  if (!displayLine?.words || displayLine.words.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < displayLine.words.length; i++) {
    if (currentPosMs >= displayLine.words[i].timeMs) idx = i;
    else break;
  }
  return idx;
}, [displayLine, currentPosMs]);

const activeGroupIndex = useMemo(() => {
  if (activeWordIndex < 0 || groupedWords.length === 0) return -1;
  return groupedWords.findIndex((group) =>
    group.syllables.some((s) => s.globalIndex === activeWordIndex)
  );
}, [activeWordIndex, groupedWords]);
```

## 3. Centering Transition Mechanics

```typescript
// Line change: exit up → fade in with first word pre-centered
useLayoutEffect(() => {
  const outer = tickerRef.current;
  const inner = tickerInnerRef.current;
  if (!outer || !inner) return;

  // Exit: slide up + fade
  outer.style.transition = "transform 0.11s ease-in, opacity 0.11s ease-in";
  outer.style.transform = "translateY(-7px)";
  outer.style.opacity = "0";

  const t = setTimeout(() => {
    const outerEl = tickerRef.current;
    const innerEl = tickerInnerRef.current;
    if (!outerEl || !innerEl) return;

    // Pre-center first word instantly without visible animation
    innerEl.style.transition = "none";
    const firstSpan = wordTickerRefs.current[0];
    if (firstSpan) {
      const half = outerEl.clientWidth / 2;
      const spanHalf = firstSpan.offsetLeft + firstSpan.offsetWidth / 2;
      const desired = half - spanHalf;
      tickerOffsetRef.current = desired;
      innerEl.style.transform = `translateX(${desired}px)`;
    } else {
      tickerOffsetRef.current = 0;
      innerEl.style.transform = "translateX(0px)";
    }

    // Reset outer position, then fade in
    outerEl.style.transition = "none";
    outerEl.style.transform = "translateY(0px)";
    outerEl.style.opacity = "0";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!tickerRef.current) return;
        tickerRef.current.style.transition = "opacity 0.22s cubic-bezier(0.16,1,0.3,1)";
        tickerRef.current.style.opacity = "1";
      });
    });
  }, 210);

  return () => clearTimeout(t);
}, [displayLine?.timeMs, trackId]);

// Scroll on word change (within the same line)
useLayoutEffect(() => {
  if (activeGroupIndex < 0) return;
  const container = tickerRef.current;
  const inner = tickerInnerRef.current;
  const span = wordTickerRefs.current[activeGroupIndex];
  if (!container || !inner || !span) return;
  const containerHalf = container.clientWidth / 2;
  const spanHalf = span.offsetLeft + span.offsetWidth / 2;
  const desired = containerHalf - spanHalf;
  tickerOffsetRef.current = desired;
  inner.style.transition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
  inner.style.transform = `translateX(${desired}px)`;
}, [activeGroupIndex]);
```

## 4. DOM Layout & Styling

- Container has fixed height `h-[18px]` and `overflow-hidden`.
- Inner wrapper has `paddingRight: "50%"` so the final word can reach the exact center.
- Active word has `#ffffff`, inactive words have `rgba(255,255,255,0.30)`.
- Fallback for non-word-synced lines uses linear duration marquee scroll if text width > container width.
