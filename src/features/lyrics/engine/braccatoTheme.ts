export const braccatoThemeCss = `
.blyrics-container {
  --blyrics-font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", var(--font-montserrat-family), system-ui, sans-serif;
  --blyrics-font-size: 2.25rem;
  --blyrics-font-weight: 700;
  --blyrics-letter-spacing: -0.02em;
  --blyrics-line-height: 1.4;
  --blyrics-padding: 1.5rem;
  --blyrics-glow-color: transparent;
  --blyrics-highlight-color: transparent;
  --blyrics-scale: 1;
  --blyrics-animate-word-wobble: 1;
  --blyrics-wobble-duration: 0.28s;
  --blyrics-word-wobble-transform-from: translateY(0) scale(1);
  --blyrics-word-wobble-transform-peak: translateY(-0.1em) scale(1.06);
  --blyrics-word-wobble-transform-settle: translateY(-0.05em) scale(1.03);
  --blyrics-word-wobble-transform-to: translateY(0) scale(1);
}

.blyrics-line {
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.35s ease, opacity 0.35s ease;
  transform-origin: left center;
  margin-bottom: 1.25rem;
}

.blyrics-line:not([data-active="true"]) {
  opacity: 0.55;
  filter: blur(1.5px);
  transform: scale(0.94);
}

.blyrics-line[data-active="true"] {
  opacity: 1;
  filter: blur(0px);
  transform: scale(1);
}

.blyrics-background-lyric {
  font-size: 0.9em;
  opacity: 0.6;
}

.blyrics--word {
  display: inline-block;
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.28s ease;
}

.blyrics--word[data-long-word] {
  transform: translateY(-0.1em) scale(1.06);
  filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.45));
}

.blyrics--translated {
  display: block;
  font-size: 1.15rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  opacity: 0.75;
  line-height: 1.35;
  margin-top: 0.35rem;
  color: var(--color-text-secondary, rgba(255, 255, 255, 0.75));
}

.blyrics--romanized {
  display: block;
  font-size: 1rem;
  font-weight: 450;
  letter-spacing: normal;
  opacity: 0.65;
  font-style: italic;
  line-height: 1.3;
  margin-top: 0.2rem;
  color: var(--color-text-tertiary, rgba(255, 255, 255, 0.6));
}

.blyrics--line.blyrics--active .blyrics--translated,
.blyrics--line[data-active="true"] .blyrics--translated {
  opacity: 0.95;
  color: rgba(255, 255, 255, 0.95);
}

.blyrics--line.blyrics--active .blyrics--romanized,
.blyrics--line[data-active="true"] .blyrics--romanized {
  opacity: 0.85;
  color: rgba(255, 255, 255, 0.85);
}

`;
