import type { ShareCardTeam } from "../components/ShareCard";

type ShareCardPayload = {
  champion: ShareCardTeam;
  runnerUp: ShareCardTeam;
  third: ShareCardTeam;
  shareUrl: string;
};

type ShareCardImageOptions = {
  backgroundColor?: string;
  coverUrl?: string;
  forceFallback?: boolean;
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

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = src;
  });

const createFallbackShareCardBlob = async (
  payload: ShareCardPayload,
  backgroundColor = "#1d1d1b",
  coverUrl?: string,
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

  const headerHeight = 460;
  if (coverUrl) {
    try {
      const coverImg = await loadImage(coverUrl);
      ctx.drawImage(coverImg, 0, 0, width, headerHeight);
      const gradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(0.6, "rgba(0,0,0,0.3)");
      gradient.addColorStop(1, "rgba(0,0,0,0.8)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, headerHeight);
    } catch {
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, width, headerHeight);
    }
  } else {
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, width, headerHeight);
  }

  const avatarSize = 192;
  const avatarX = width / 2;
  const avatarY = headerHeight - avatarSize / 2 + 20;
  ctx.fillStyle = "#0b0b0b";
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize / 2 + 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  if (payload.champion.escudo) {
    try {
      const champImg = await loadImage(payload.champion.escudo);
      ctx.drawImage(
        champImg,
        avatarX - avatarSize / 2,
        avatarY - avatarSize / 2,
        avatarSize,
        avatarSize,
      );
    } catch {
      ctx.fillStyle = "#111111";
      ctx.fillRect(avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    }
  } else {
    ctx.fillStyle = "#111111";
    ctx.fillRect(avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 72px 'Afacad Flux', sans-serif";
  const nameY = avatarY + avatarSize / 2 + 60;
  wrapText(ctx, (payload.champion.name || "Por definir").toUpperCase(), width / 2, nameY, width - 120, 78);

  ctx.fillStyle = "#c6f600";
  ctx.font = "900 72px 'Afacad Flux', sans-serif";
  ctx.fillText("CAMPEÓN", width / 2, nameY + 90);

  const podiumY = nameY + 120;
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "24px 'Afacad Flux', sans-serif";
  ctx.fillText("Segundo lugar", width / 2, podiumY + 110);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px 'Afacad Flux', sans-serif";
  wrapText(ctx, payload.runnerUp.name || "Por definir", width / 2, podiumY + 148, width - 200, 32);

  ctx.fillStyle = "#a1a1aa";
  ctx.font = "24px 'Afacad Flux', sans-serif";
  ctx.fillText("Tercer lugar", width / 2, podiumY + 210);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px 'Afacad Flux', sans-serif";
  wrapText(ctx, payload.third.name || "Por definir", width / 2, podiumY + 248, width - 200, 32);

  ctx.fillStyle = "#c6f600";
  ctx.font = "bold 24px 'Afacad Flux', sans-serif";
  ctx.fillText("Ver mi pronóstico", width / 2, height - 90);
  ctx.fillStyle = "#ffffff";
  ctx.font = "22px 'Afacad Flux', sans-serif";
  wrapText(ctx, payload.shareUrl || "", width / 2, height - 50, width - 120, 26);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear imagen"))), "image/png"),
  );
  return blob;
};

export const createShareCardBlob = async (
  payload: ShareCardPayload,
  _target?: HTMLElement | null,
  options?: ShareCardImageOptions,
) => {
  const backgroundColor = options?.backgroundColor || "#1d1d1b";
  const coverUrl = options?.coverUrl;
  return createFallbackShareCardBlob(payload, backgroundColor, coverUrl);
};
