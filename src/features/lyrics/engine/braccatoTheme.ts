/* Cherry-picked from the Sustain theme in the braccato repo (demo/theme-sustain.css),
   minus its webfont, its font declarations, its distance blur ramp, and its agent
   alignment (lyrics.css already ships that). Passed to the element as a string. */

export const braccatoThemeCss = `
/* blyrics-target-scroll-pos-ratio = 0.5; */

.blyrics-container {
  --blyrics-font-family: "Satoshi", var(--font-inter), system-ui, sans-serif;
  --blyrics-font-size: 2rem;
  --blyrics-font-weight: 600;
  --blyrics-line-height: 1.4;
  --blyrics-padding: 1.25rem;
  --blyrics-glow-color: transparent;
  --blyrics-highlight-color: transparent;
  --blyrics-wobble-duration: 1s;
  --blyrics-word-wobble-transform-from: translateY(0);
  --blyrics-word-wobble-transform-peak: translateY(-0.005em);
  --blyrics-word-wobble-transform-settle: translateY(-0.028em);
  --blyrics-word-wobble-transform-to: translateY(-0.0375em);
}

.blyrics-container > div {
  transition: transform 0.166s var(--blyrics-anim-delay, 0s);
}

.blyrics-container > div:hover {
  transform: scale(1.01);
  transition: transform 0.3s ease;
}

.blyrics-background-lyric {
  font-size: 0.9em;
}

/* Only words held past long-word threshold glow */
.blyrics--word,
.blyrics--word::after,
.blyrics-word-highlight {
  --blyrics-glow-color: transparent;
  --blyrics-highlight-color: transparent;
}

.blyrics--word[data-long-word],
.blyrics--word[data-long-word]::after,
.blyrics--word[data-long-word] > .blyrics-word-highlight {
  --blyrics-glow-color: color(display-p3 1 1 1 / 1);
  --blyrics-highlight-color: color(display-p3 1 1 1 / 1);
}
`;
