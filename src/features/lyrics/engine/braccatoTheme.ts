export const braccatoThemeCss = `
.blyrics-container {
  --blyrics-font-family: "Satoshi", var(--font-inter), system-ui, sans-serif;
  --blyrics-font-size: 2rem;
  --blyrics-font-weight: 600;
  --blyrics-line-height: 1.4;
  --blyrics-padding: 1.25rem;
  --blyrics-glow-color: transparent;
  --blyrics-highlight-color: transparent;
  --blyrics-scale: 1;
  --blyrics-animate-word-wobble: 0;
  --blyrics-wobble-duration: 0s;
  --blyrics-word-wobble-transform-from: none;
  --blyrics-word-wobble-transform-peak: none;
  --blyrics-word-wobble-transform-settle: none;
  --blyrics-word-wobble-transform-to: none;
}

.blyrics-container > div {
  transform: none !important;
}

.blyrics-container > div:hover {
  transform: none !important;
}

.blyrics-background-lyric {
  font-size: 0.9em;
}

.blyrics--word,
.blyrics--word::after,
.blyrics-word-highlight {
  --blyrics-glow-color: transparent;
  --blyrics-highlight-color: transparent;
  transform: none !important;
}

.blyrics--word[data-long-word],
.blyrics--word[data-long-word]::after,
.blyrics--word[data-long-word] > .blyrics-word-highlight {
  --blyrics-glow-color: color(display-p3 1 1 1 / 1);
  --blyrics-highlight-color: color(display-p3 1 1 1 / 1);
  transform: none !important;
}
`;
