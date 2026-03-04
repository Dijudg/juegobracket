import { useState } from "react";

import modalBackImage from "../assets/fondo.jpg";
import shareBackLogo from "../assets/7flapollalog.png";

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

const ShareCardFront = ({
  coverUrl,
  champion,
  runnerUp,
  third,
  variant,
}: Pick<ShareCardProps, "coverUrl" | "champion" | "runnerUp" | "third" | "variant">) => {
  const baseClass = "share-card";
  const className = variant === "spin" ? `${baseClass} share-card--holo` : baseClass;
  return (
    <div className={className}>
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
      </div>
    </div>
  );
};

const ShareCardBack = () => (
  <div className="share-card share-card--back share-card--holo">
    <img className="share-card__back-logo" src={shareBackLogo} alt="7flapollalog" />
  </div>
);

export const ShareCard = ({ coverUrl, champion, runnerUp, third, shareUrl, variant = "static" }: ShareCardProps) => {
  const isSpin = variant === "spin";
  const [isFlipped, setIsFlipped] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

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

  const isManual = isFlipped || isHovered || isFocused;
  const toggleFlip = () => setIsFlipped((prev) => !prev);
  const cardClassName = [
    "share-card-flip__card",
    isManual ? "share-card-flip__card--manual" : "",
    isFlipped ? "share-card-flip__card--flipped" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="share-card-flip share-card-flip--spin"
      style={{ ["--share-card-back" as any]: `url(${modalBackImage})` }}
      role="button"
      tabIndex={0}
      aria-pressed={isFlipped}
      aria-label="Girar tarjeta compartida"
      onClick={toggleFlip}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleFlip();
        }
      }}
    >
      <div className={cardClassName}>
        <div className="share-card-flip__face share-card-flip__face--back" aria-hidden="true">
          <ShareCardBack />
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
