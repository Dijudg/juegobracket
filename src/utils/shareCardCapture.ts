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
  const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor });
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear imagen"))), "image/png"),
  );
  return blob;
};
