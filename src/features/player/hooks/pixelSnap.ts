export interface SnappedBox {
  width: number;
  height: number;
  dpr: number;
}

export function snapStage(host: HTMLElement, stage: HTMLElement): SnappedBox {
  const dpr = window.devicePixelRatio || 1;
  const rect = host.getBoundingClientRect();
  const left = Math.round(rect.left * dpr);
  const top = Math.round(rect.top * dpr);
  const width = (Math.round(rect.right * dpr) - left) / dpr;
  const height = (Math.round(rect.bottom * dpr) - top) / dpr;
  const shiftX = left / dpr - rect.left;
  const shiftY = top / dpr - rect.top;
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  stage.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
  return { width, height, dpr };
}
