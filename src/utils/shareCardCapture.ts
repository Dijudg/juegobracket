import html2canvas from "html2canvas";

const waitForImages = async (target: HTMLElement) => {
  const images = Array.from(target.querySelectorAll("img"));
  if (!images.length) return;
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const onDone = () => {
            img.removeEventListener("load", onDone);
            img.removeEventListener("error", onDone);
            resolve();
          };
          img.addEventListener("load", onDone, { once: true });
          img.addEventListener("error", onDone, { once: true });
        }),
    ),
  );
};

export const captureShareCard = async (target: HTMLElement, backgroundColor = "#1d1d1b") => {
  await waitForImages(target);
  if (typeof document !== "undefined") {
    try {
      await (document as any).fonts?.ready;
    } catch {
      // ignore font loading errors
    }
  }
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    throw new Error("La tarjeta para compartir no tiene tamaño.");
  }
  const canvas = await html2canvas(target, {
    scale: Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 2),
    useCORS: true,
    backgroundColor,
    imageTimeout: 15000,
    logging: false,
  });
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear imagen"))), "image/png"),
  );
  return blob;
};
