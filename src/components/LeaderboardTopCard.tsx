import { ShareCard, type ShareCardTeam } from "./ShareCard";
import winnerCardBg from "../assets/final.jpg";

type LeaderboardTopCardProps = {
  rank: number;
  playerName: string;
  avatarUrl?: string;
  totalPoints: number;
  champion: ShareCardTeam;
  runnerUp: ShareCardTeam;
  third: ShareCardTeam;
  shareUrl: string;
};

export function LeaderboardTopCard({
  rank,
  playerName,
  avatarUrl,
  totalPoints,
  champion,
  runnerUp,
  third,
  shareUrl,
}: LeaderboardTopCardProps) {
  const tone = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "default";
  const initial = playerName.trim().charAt(0).toUpperCase() || "U";
  return (
    <article className={`leaderboard-top-card leaderboard-top-card--${tone}`}>
      <header className="leaderboard-top-card__meta">
        {avatarUrl ? (
          <img src={avatarUrl} alt={playerName} className={`leaderboard-top-card__avatar leaderboard-top-card__avatar--${tone}`} />
        ) : (
          <span className={`leaderboard-top-card__avatar leaderboard-top-card__avatar--${tone}`}>{initial}</span>
        )}
        <div className="leaderboard-top-card__text">
          <p className="leaderboard-top-card__name">{playerName}</p>
          <p className={`leaderboard-accent leaderboard-accent--${tone} leaderboard-top-card__points`}>{totalPoints} pts</p>
        </div>
      </header>
      <div className="leaderboard-top-card__card-wrap">
        <ShareCard
          coverUrl={winnerCardBg}
          champion={champion}
          runnerUp={runnerUp}
          third={third}
          shareUrl={shareUrl}
          variant="spin"
          runnerUpLabel="Plata"
          thirdLabel="Bronce"
        />
      </div>
      <a
        href={shareUrl}
        className="leaderboard-top-card__view-btn"
      >
        Ver bracket
      </a>
    </article>
  );
}
