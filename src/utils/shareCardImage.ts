import type { ShareCardTeam } from "../components/ShareCard";
import fondoCompartir from "../assets/fondo-compartir.png";
import logoFanatico from "../assets/Logofanatico.svg";

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

const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
};

const drawCircleImage = async (
  ctx: CanvasRenderingContext2D,
  src: string | undefined,
  cx: number,
  cy: number,
  size: number,
) => {
  // aro/fondo
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + 6, 0, Math.PI * 2);
  ctx.fill();

  // imagen recortada en círculo
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.clip();

  if (src) {
    try {
      const img = await loadImage(src);
      ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    } catch {
      ctx.fillStyle = "#111111";
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    }
  } else {
    ctx.fillStyle = "#111111";
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  }

  ctx.restore();
};

const createFallbackShareCardBlob = async (
  payload: ShareCardPayload,
  backgroundColor = "transparent",
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

  ctx.clearRect(0, 0, width, height);
  if (fondoCompartir) {
    try {
      const bgImg = await loadImage(fondoCompartir);
      ctx.drawImage(bgImg, 0, 0, width, height);
    } catch {
      // leave transparent if background fails
    }
  }
  if (backgroundColor !== "transparent") {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }
  const headerHeight = 460;
  if (coverUrl) {
    try {
      const coverImg = await loadImage(coverUrl);
      drawImageCover(ctx, coverImg, 0, 0, width, headerHeight);
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

  const avatarSize = 250;
  const avatarX = width / 2;
  const avatarYOffset = 60; 
  const avatarY = headerHeight - avatarSize / 2 + avatarYOffset;
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
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    }
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.10)";
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

  // layout 2 columnas
  const paddingX = 80;
  const gap = 24;
  const cardW = (width - paddingX * 2 - gap) / 2;
  const cardH = 150;
  const leftX = paddingX;
  const rightX = paddingX + cardW + gap;
  const cardsY = podiumY + 60;

  const drawPodiumCard = async (
    x: number,
    y: number,
    label: string,
    team: ShareCardTeam,
  ) => {
    // Card bg
          ctx.lineWidth = 2;

    const r = 18;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + cardW, y, x + cardW, y + cardH, r);
    ctx.arcTo(x + cardW, y + cardH, x, y + cardH, r);
    ctx.arcTo(x, y + cardH, x, y, r);
    ctx.arcTo(x, y, x + cardW, y, r);
    ctx.closePath();
 

    // Escudo (tu “bandera”)
    const imgSize = 64;
    const imgCx = x + 26 + imgSize / 2;
    const imgCy = y + 24 + imgSize / 2;
    await drawCircleImage(ctx, team.escudo, imgCx, imgCy, imgSize);

    // Textos
    const textX = x + 26 + imgSize + 18;
    const textW = cardW - (26 + imgSize + 18) - 26;

    ctx.textAlign = "left";
    ctx.fillStyle = "#c6f600";
    ctx.font = "24px 'Afacad Flux', sans-serif";
    ctx.fillText(label, textX, y + 56);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px 'Afacad Flux', sans-serif";
    wrapText(ctx, team.name || "Por definir", textX, y + 98, textW, 34);
  };

  // pinta las dos tarjetas
  await drawPodiumCard(leftX, cardsY, "Segundo lugar", payload.runnerUp);
  await drawPodiumCard(rightX, cardsY, "Tercer lugar", payload.third);

  

  // Logo Fanatico (90% ancho, alto proporcional)
  try {
    const logoImg = await loadImage(logoFanatico);
    const logoWidth = width * 0.9;
    const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
    const logoX = (width - logoWidth) / 2;
    const logoY = Math.max(height - 140 - logoHeight, headerHeight + 40);
    ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
  } catch {
    // ignore logo failures
  }
// vuelve a centrar para lo siguiente
  ctx.textAlign = "center";
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
  const backgroundColor = options?.backgroundColor || "transparent";
  const coverUrl = options?.coverUrl;
  return createFallbackShareCardBlob(payload, backgroundColor, coverUrl);
};
