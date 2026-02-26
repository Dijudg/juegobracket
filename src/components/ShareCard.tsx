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
};

export type { ShareCardTeam, ShareCardProps };

export const ShareCard = ({ coverUrl, champion, runnerUp, third, shareUrl }: ShareCardProps) => {
  return (
    <div className="share-card">
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
        <div className="share-card__cta">
          <div className="share-card__cta-text">Ver mi pronóstico</div>
        </div>
      </div>
    </div>
  );
};
