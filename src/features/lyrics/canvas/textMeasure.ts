export interface TextMeasure {
  width: (font: string, text: string) => number;
  ascent: (font: string) => number;
  descent: (font: string) => number;
}

export function createTextMeasure(ctx: CanvasRenderingContext2D): TextMeasure {
  const widths = new Map<string, number>();
  const metrics = new Map<string, TextMetrics>();

  const metricsFor = (font: string) => {
    const cached = metrics.get(font);
    if (cached) return cached;
    ctx.font = font;
    const next = ctx.measureText("Hg");
    metrics.set(font, next);
    return next;
  };

  return {
    width: (font, text) => {
      const key = `${font}\u0000${text}`;
      const cached = widths.get(key);
      if (cached !== undefined) return cached;
      ctx.font = font;
      const value = ctx.measureText(text).width;
      widths.set(key, value);
      return value;
    },
    ascent: (font) => metricsFor(font).fontBoundingBoxAscent,
    descent: (font) => metricsFor(font).fontBoundingBoxDescent,
  };
}
