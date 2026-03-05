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

const DEFAULT_SPIN_DURATION = 30;
const MIN_SPIN_DURATION = 14;
const MAX_SPIN_DURATION = 60;
const MAX_SPIN_VELOCITY = 4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
      <div className="holo-content">{children}</div>
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
    <div className="share-card__header">
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
        <div className="share-card__champion share-card__champion--fallback">N/A</div>
      )}
    </div>
    <div className="share-card__body">
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
     <img className=" mx-auto py-4" src={logoFanatico} alt="Fanatico" />
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
  const className = variant === "spin" ? `${baseClass} share-card--holo` : baseClass;

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
  const className = "share-card share-card--back share-card--holo";
  if (variant === "spin") {
    return (
      <HoloCard className={className}>
        <img className="" src={shareBackLogo} alt="7flapollalog" />
      </HoloCard>
    );
  }

  return (
    <div className={className}>
      <img className="share-card__back-logo" src={shareBackLogo} alt="7flapollalog" />
    </div>
  );
};

export const ShareCard = ({ coverUrl, champion, runnerUp, third, shareUrl, variant = "static" }: ShareCardProps) => {
  const isSpin = variant === "spin";
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({ active: false, lastX: 0, lastTime: 0 });
  const spinStateRef = useRef({
    duration: DEFAULT_SPIN_DURATION,
    direction: "normal" as "normal" | "reverse",
  });
  const [isDragging, setIsDragging] = useState(false);

  const applySpin = useCallback((duration: number, direction: "normal" | "reverse") => {
    const clampedDuration = clamp(duration, MIN_SPIN_DURATION, MAX_SPIN_DURATION);
    spinStateRef.current = { duration: clampedDuration, direction };
    const node = cardRef.current;
    if (!node) return;
    node.style.setProperty("--share-spin-duration", `${clampedDuration}s`);
    node.style.setProperty("--share-spin-direction", direction);
  }, []);

  useEffect(() => {
    if (!isSpin) return;
    applySpin(DEFAULT_SPIN_DURATION, "normal");
  }, [applySpin, isSpin]);

  const handlePointerEnter = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = { active: true, lastX: event.clientX, lastTime: event.timeStamp };
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = { active: true, lastX: event.clientX, lastTime: event.timeStamp };
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current.active) return;
      const deltaX = event.clientX - dragStateRef.current.lastX;
      const deltaTime = Math.max(event.timeStamp - dragStateRef.current.lastTime, 16);
      const velocity = deltaX / deltaTime;
      const absVelocity = clamp(Math.abs(velocity), 0, MAX_SPIN_VELOCITY);
      const normalized = absVelocity / MAX_SPIN_VELOCITY;
      const t = normalized * normalized;
      const nextDuration = MAX_SPIN_DURATION - t * (MAX_SPIN_DURATION - MIN_SPIN_DURATION);
      const nextDirection = velocity >= 0 ? "normal" : "reverse";
      applySpin(nextDuration, nextDirection);
      dragStateRef.current.lastX = event.clientX;
      dragStateRef.current.lastTime = event.timeStamp;
    },
    [applySpin],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePointerLeave = useCallback(() => {
    dragStateRef.current.active = false;
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const { duration, direction } = spinStateRef.current;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        applySpin(duration, "reverse");
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        applySpin(duration, "normal");
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        applySpin(duration - 4, direction);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        applySpin(duration + 4, direction);
      }
    },
    [applySpin],
  );

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
      onPointerEnter={handlePointerEnter}
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
