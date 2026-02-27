import type { ShareCardTeam } from "../components/ShareCard";
import { captureShareCard } from "./shareCardCapture";

type ShareCardPayload = {
  champion: ShareCardTeam;
  runnerUp: ShareCardTeam;
  third: ShareCardTeam;
  shareUrl: string;
};

type ShareCardImageOptions = {
  backgroundColor?: string;
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) => {
  const words = text.split(" ").filter(Boolean);
  let line = "";
  let cursorY = y;
  for (let i = 0; i < words.length; i += 1) {
    const testLine = `${line}${words[i]} `;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line.trim(), x, cursorY);
      line = `${words[i]} `;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) {
    ctx.fillText(line.trim(), x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
};

const createFallbackShareCardBlob = async (
  payload: ShareCardPayload,
  backgroundColor = "#1d1d1b",
) => {
  if (typeof document === "undefined") {
    throw new Error("No document available for fallback share card.");
  }
  const canvas = document.createElement("canvas");
  const width = 800;
  const height = 1200;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context available.");

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#c6f600";
  ctx.fillRect(0, 0, width, 140);

  ctx.fillStyle = "#111111";
  ctx.font = "bold 46px 'Afacad Flux', sans-serif";
  ctx.fillText("Mi Pronostico", 40, 90);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px 'Afacad Flux', sans-serif";
  let cursorY = 220;
  ctx.fillText("Campeon", 40, cursorY);
  cursorY += 60;
  ctx.font = "bold 52px 'Afacad Flux', sans-serif";
  cursorY = wrapText(ctx, payload.champion.name || "Por definir", 40, cursorY, width - 80, 56);

  cursorY += 30;
  ctx.fillStyle = "#c6f600";
  ctx.font = "bold 36px 'Afacad Flux', sans-serif";
  ctx.fillText("Segundo lugar", 40, cursorY);
  cursorY += 48;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px 'Afacad Flux', sans-serif";
  cursorY = wrapText(ctx, payload.runnerUp.name || "Por definir", 40, cursorY, width - 80, 44);

  cursorY += 24;
  ctx.fillStyle = "#c6f600";
  ctx.font = "bold 36px 'Afacad Flux', sans-serif";
  ctx.fillText("Tercer lugar", 40, cursorY);
  cursorY += 48;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px 'Afacad Flux', sans-serif";
  cursorY = wrapText(ctx, payload.third.name || "Por definir", 40, cursorY, width - 80, 44);

  ctx.fillStyle = "#c6f600";
  ctx.font = "bold 30px 'Afacad Flux', sans-serif";
  ctx.fillText("Ver mi pronostico", 40, height - 80);
  ctx.fillStyle = "#ffffff";
  ctx.font = "24px 'Afacad Flux', sans-serif";
  wrapText(ctx, payload.shareUrl || "", 40, height - 40, width - 80, 28);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear imagen"))), "image/png"),
  );
  return blob;
};

export const createShareCardBlob = async (
  payload: ShareCardPayload,
  target?: HTMLElement | null,
  options?: ShareCardImageOptions,
) => {
  const backgroundColor = options?.backgroundColor || "#1d1d1b";
  if (target) {
    try {
      return await captureShareCard(target, backgroundColor);
    } catch {
      // Fall back to canvas-based card below.
    }
  }
  return createFallbackShareCardBlob(payload, backgroundColor);
};
