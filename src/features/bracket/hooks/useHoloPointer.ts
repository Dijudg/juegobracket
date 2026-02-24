import { useCallback, useRef } from "react";
import type { PointerEvent } from "react";

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);
const round = (value: number, precision = 3) => parseFloat(value.toFixed(precision));
const adjust = (value: number, fromMin: number, fromMax: number, toMin: number, toMax: number) =>
  round(toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin));

const setHoloVars = (el: HTMLDivElement, px: number, py: number) => {
  const cx = px - 50;
  const cy = py - 50;
  const pointerFromCenter = Math.min(Math.sqrt(cx * cx + cy * cy) / 50, 1);

  el.style.setProperty("--pointer-x", `${round(px)}%`);
  el.style.setProperty("--pointer-y", `${round(py)}%`);
  el.style.setProperty("--background-x", `${adjust(px, 0, 100, 35, 65)}%`);
  el.style.setProperty("--background-y", `${adjust(py, 0, 100, 35, 65)}%`);
  el.style.setProperty("--pointer-from-center", `${round(pointerFromCenter)}`);
  el.style.setProperty("--pointer-from-top", `${round(py / 100)}`);
  el.style.setProperty("--pointer-from-left", `${round(px / 100)}`);
  el.style.setProperty("--rotate-x", `${round(-(cx / 5))}deg`);
  el.style.setProperty("--rotate-y", `${round(cy / 4)}deg`);
};

export const useHoloPointer = () => {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = clamp(((event.clientX - rect.left) / rect.width) * 100);
    const py = clamp(((event.clientY - rect.top) / rect.height) * 100);
    setHoloVars(el, px, py);
  }, []);

  const handlePointerEnter = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      el.classList.add("holo-active");
      handlePointerMove(event);
    },
    [handlePointerMove],
  );

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("holo-active");
    setHoloVars(el, 50, 50);
  }, []);

  return {
    ref,
    onPointerMove: handlePointerMove,
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
  };
};
