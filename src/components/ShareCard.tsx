import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

import modalBackImage from "../assets/fondo.jpg";
import shareBackLogo from "../assets/7flapollalog.png";
import logoFanatico from "../assets/Logofanatico.svg";
import { useHoloPointer } from "../features/bracket/hooks/useHoloPointer";

type ShareCardTeam = {
  name: string;
  escudo?: string;
};

type ShareCardProps = {
  coverUrl: string;
  champion: ShareCardTeam;
  runnerUp: ShareCardTeam;
  third: ShareCardTeam;
  shareUrl: string;
  variant?: "static" | "spin";
};

export type { ShareCardTeam, ShareCardProps };

const isTouch =
  typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const deg2rad = (value: number) => (value * Math.PI) / 180;
const rad2deg = (value: number) => (value * 180) / Math.PI;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const ROTATE_SPEED = 0.005;
const INERTIA = 0.92;
const AUTO_ROTATE_SPEED = 0.35;
const MAX_TILT = deg2rad(25);
const HOVER_MAG = deg2rad(6);
const HOVER_EASE = 0.15;
const DEVICE_TILT_MAG = deg2rad(10);

const HoloCard = ({ className, children }: { className: string; children: ReactNode }) => {
  const holo = useHoloPointer();
  return (
    <div
      ref={holo.ref}
      onPointerEnter={holo.onPointerEnter}
      onPointerMove={holo.onPointerMove}
      onPointerLeave={holo.onPointerLeave}
      className={`holo-card ${className}`.trim()}
    >
      <div className="holo-surface" aria-hidden="true" />
      <div className="holo-glare" aria-hidden="true" />
      <div className="holo-content   ">{children}</div>
    </div>
  );
};

const ShareCardFrontContent = ({
  coverUrl,
  champion,
  runnerUp,
  third,
}: Pick<ShareCardProps, "coverUrl" | "champion" | "runnerUp" | "third">) => (
  <>
    <div className="share-card__header holo-header">
      {coverUrl && (
        <img
          className="share-card__cover"
          src={coverUrl}
          crossOrigin="anonymous"
          alt="Portada"
        />
      )}
      {champion.escudo ? (
        <img
          className="share-card__champion"
          src={champion.escudo}
          crossOrigin="anonymous"
          alt={champion.name}
        />
      ) : (
        <div className="share-card__champion share-card__champion--fallback ">N/A</div>
      )}
    </div>
    <div className="share-card__body  ">
      <div className="share-card__title">
        <div className="share-card__title-name">{champion.name}</div>
        <div className="share-card__title-label">Campeón</div>
      </div>
      <div className="share-card__podium">
        <div className="share-card__podium-item">
          {runnerUp.escudo ? (
            <img
              className="share-card__podium-flag"
              src={runnerUp.escudo}
              crossOrigin="anonymous"
              alt={runnerUp.name}
            />
          ) : (
            <div className="share-card__podium-flag share-card__podium-flag--fallback">N/A</div>
          )}
          <div className="share-card__podium-text">
            <div className="share-card__podium-name">{runnerUp.name}</div>
            <div className="share-card__podium-label share-card__podium-label--second">Segundo lugar</div>
            
          </div>
        </div>
        <div className="share-card__podium-item">
          {third.escudo ? (
            <img
              className="share-card__podium-flag"
              src={third.escudo}
              crossOrigin="anonymous"
              alt={third.name}
            />
          ) : (
            <div className="share-card__podium-flag share-card__podium-flag--fallback">N/A</div>
          )}
          <div className="share-card__podium-text">
            <div className="share-card__podium-name">{third.name}</div>
            <div className="share-card__podium-label share-card__podium-label--third">Tercer lugar</div>
       
          </div>
        </div>
      </div>
    <img className="mx-auto" src={logoFanatico} alt="Fanatico" />
    </div>
  </>
);

const ShareCardFront = ({
  coverUrl,
  champion,
  runnerUp,
  third,
  variant,
}: Pick<ShareCardProps, "coverUrl" | "champion" | "runnerUp" | "third" | "variant">) => {
  const baseClass = "share-card";
  const className = variant === "spin" ? `${baseClass}  ` : baseClass;

  if (variant === "spin") {
    return (
      <HoloCard className={className}>
        <ShareCardFrontContent
          coverUrl={coverUrl}
          champion={champion}
          runnerUp={runnerUp}
          third={third}
        />
      </HoloCard>
    );
  }

  return (
    <div className={className}>
      <ShareCardFrontContent
        coverUrl={coverUrl}
        champion={champion}
        runnerUp={runnerUp}
        third={third}
      />
    </div>
  );
};

const ShareCardBack = ({ variant }: { variant?: ShareCardProps["variant"] }) => {
  const className = "share-card share-card--back holo-header";
  if (variant === "spin") {
    return (
      <div className={className}>
        <img className="items-center justify-center holo-header" src={shareBackLogo} alt="7flapollalog" />
      </div>
    );
  }

  return (
    <div className={className}>
      <img className="" src={shareBackLogo} alt="7flapollalog" />
    </div>
  );
};

export const ShareCard = ({ coverUrl, champion, runnerUp, third, shareUrl, variant = "static" }: ShareCardProps) => {
  const isSpin = variant === "spin";
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const isDraggingRef = useRef(false);
  const autoDirRef = useRef(1);
  const autoSpeedRef = useRef(AUTO_ROTATE_SPEED);
  const baseRotRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const hoverTargetRef = useRef({ x: 0, y: 0 });
  const hoverCurrentRef = useRef({ x: 0, y: 0 });
  const lastTimeRef = useRef<number | null>(null);
  const orientationEnabledRef = useRef(false);
  const orientationRequestedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const applyTransform = useCallback((x: number, y: number) => {
    const node = cardRef.current;
    if (!node) return;
    node.style.setProperty("--share-rot-x", `${rad2deg(x)}deg`);
    node.style.setProperty("--share-rot-y", `${rad2deg(y)}deg`);
  }, []);

  useEffect(() => {
    if (!isSpin) return;
    let rafId = 0;
    const tick = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;

      if (!isDraggingRef.current) {
        baseRotRef.current.y += autoDirRef.current * autoSpeedRef.current * dt;
        baseRotRef.current.y += velRef.current.x;
        baseRotRef.current.x = clamp(baseRotRef.current.x + velRef.current.y, -MAX_TILT, MAX_TILT);
        velRef.current.x *= INERTIA;
        velRef.current.y *= INERTIA;
      }

      hoverCurrentRef.current.x +=
        (hoverTargetRef.current.x - hoverCurrentRef.current.x) * HOVER_EASE;
      hoverCurrentRef.current.y +=
        (hoverTargetRef.current.y - hoverCurrentRef.current.y) * HOVER_EASE;

      const renderX = baseRotRef.current.x + hoverCurrentRef.current.x;
      const renderY = baseRotRef.current.y + hoverCurrentRef.current.y;
      applyTransform(renderX, renderY);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [applyTransform, isSpin]);

  const enableDeviceTilt = useCallback(async () => {
    if (!isSpin || !isTouch || typeof window === "undefined") return;
    if (orientationRequestedRef.current) return;
    orientationRequestedRef.current = true;
    const DeviceOrientationEventRef = (window as Window & { DeviceOrientationEvent?: any })
      .DeviceOrientationEvent;
    if (!DeviceOrientationEventRef) return;
    if (typeof DeviceOrientationEventRef.requestPermission === "function") {
      try {
        const result = await DeviceOrientationEventRef.requestPermission();
        orientationEnabledRef.current = result === "granted";
      } catch {
        orientationEnabledRef.current = false;
      }
    } else {
      orientationEnabledRef.current = true;
    }
  }, [isSpin]);

  useEffect(() => {
    if (!isSpin || !isTouch || typeof window === "undefined") return;
    const DeviceOrientationEventRef = (window as Window & { DeviceOrientationEvent?: any })
      .DeviceOrientationEvent;
    if (!DeviceOrientationEventRef) return;

    if (typeof DeviceOrientationEventRef.requestPermission !== "function") {
      orientationEnabledRef.current = true;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!orientationEnabledRef.current || isDraggingRef.current) return;
      const beta = typeof event.beta === "number" ? event.beta : 0;
      const gamma = typeof event.gamma === "number" ? event.gamma : 0;
      const nx = clamp(beta / 45, -1, 1);
      const ny = clamp(gamma / 45, -1, 1);
      hoverTargetRef.current = { x: nx * DEVICE_TILT_MAG, y: ny * DEVICE_TILT_MAG };
    };

    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => window.removeEventListener("deviceorientation", handleOrientation, true);
  }, [isSpin]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = { active: true, lastX: event.clientX, lastY: event.clientY };
    isDraggingRef.current = true;
    setIsDragging(true);
    hoverTargetRef.current = { x: 0, y: 0 };
    if (event.pointerType === "touch") {
      void enableDeviceTilt();
    }
  }, [enableDeviceTilt]);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (isDraggingRef.current) {
        const dx = event.clientX - dragStateRef.current.lastX;
        const dy = event.clientY - dragStateRef.current.lastY;
        dragStateRef.current.lastX = event.clientX;
        dragStateRef.current.lastY = event.clientY;

        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          event.preventDefault();
          baseRotRef.current.y += dx * ROTATE_SPEED;
          baseRotRef.current.x = clamp(baseRotRef.current.x + dy * ROTATE_SPEED, -MAX_TILT, MAX_TILT);
          velRef.current = { x: dx * ROTATE_SPEED, y: dy * ROTATE_SPEED };
          if (Math.abs(dx) > 1) autoDirRef.current = dx >= 0 ? 1 : -1;
        }
        return;
      }

      if (isTouch) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = (event.clientY - rect.top) / rect.height;
      const px = clamp(nx * 2 - 1, -1, 1);
      const py = clamp(ny * 2 - 1, -1, 1);
      hoverTargetRef.current = { x: -py * HOVER_MAG, y: px * HOVER_MAG };
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handlePointerLeave = useCallback(() => {
    isDraggingRef.current = false;
    dragStateRef.current.active = false;
    setIsDragging(false);
    hoverTargetRef.current = { x: 0, y: 0 };
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      autoDirRef.current = -1;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      autoDirRef.current = 1;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      autoSpeedRef.current = clamp(autoSpeedRef.current + 0.05, 0.05, 1.2);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      autoSpeedRef.current = clamp(autoSpeedRef.current - 0.05, 0.05, 1.2);
    }
  }, []);

  if (!isSpin) {
    return (
      <ShareCardFront
        coverUrl={coverUrl}
        champion={champion}
        runnerUp={runnerUp}
        third={third}
        variant={variant}
      />
    );
  }

  return (
    <div
      className={`share-card-flip share-card-flip--spin${isDragging ? " is-dragging" : ""}`}
      style={{ ["--share-card-back" as any]: `url(${modalBackImage})` }}
      role="group"
      tabIndex={0}
      aria-label="Controla la rotación de la tarjeta compartida"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerLeave}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      <div className="share-card-flip__card" ref={cardRef}>
        <div className="share-card-flip__face share-card-flip__face--back" aria-hidden="true">
          <ShareCardBack variant={variant} />
        </div>
        <div className="share-card-flip__face share-card-flip__face--front">
          <ShareCardFront
            coverUrl={coverUrl}
            champion={champion}
            runnerUp={runnerUp}
            third={third}
            variant={variant}
          />
        </div>
      </div>
    </div>
  );
};
