import { useEffect } from "react";

export const useBodyScrollLock = (locked: boolean) => {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const root = document.documentElement;

    if (!locked) {
      body.style.overflow = "";
      body.style.paddingRight = "";
      root.style.overflow = "";
      return;
    }

    const scrollBarWidth = window.innerWidth - root.clientWidth;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      body.style.overflow = "";
      body.style.paddingRight = "";
      root.style.overflow = "";
    };
  }, [locked]);
};
