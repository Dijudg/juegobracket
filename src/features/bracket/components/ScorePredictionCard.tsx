import type { Match, MatchSchedule, ScorePrediction, Team } from "../types";
import { formatFixtureDate, getTeamCode, getTeamEscudo } from "../utils";

type ScorePredictionCardProps = {
  matchId: string;
  title?: string;
  phaseLabel?: string;
  dateLabel?: string;
  schedule?: MatchSchedule;
  homeTeam?: Team;
  awayTeam?: Team;
  value?: ScorePrediction;
  locked?: boolean;
  compact?: boolean;
  selectedWinnerId?: string;
  scorePoints?: number;
  onScoreChange: (matchId: string, side: "home" | "away", value: number | null) => void;
  onWinnerPick?: (matchId: string, team?: Team) => void;
};

const clampGoal = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(99, parsed));
};

const TeamCell = ({
  team,
  align = "left",
}: {
  team?: Team;
  align?: "left" | "right";
}) => {
  const escudo = getTeamEscudo(team);
  const code = getTeamCode(team) || "--";
  return (
    <div className={`score-prediction-card__team score-prediction-card__team--${align}`}>
      <span className="score-prediction-card__flag">
        {escudo ? <img src={escudo} alt={team?.nombre || code} /> : <span>{code}</span>}
      </span>
      <span className="score-prediction-card__name">{team?.nombre || "Por definir"}</span>
    </div>
  );
};

export const ScorePredictionCard = ({
  matchId,
  title,
  phaseLabel = "Fase de grupos",
  dateLabel,
  schedule,
  homeTeam,
  awayTeam,
  value,
  locked,
  compact,
  selectedWinnerId,
  scorePoints = 0,
  onScoreChange,
  onWinnerPick,
}: ScorePredictionCardProps) => {
  const resolvedDate = dateLabel || formatFixtureDate(schedule?.fecha);
  const resolvedTime = schedule?.hora?.trim();
  const dateTimeLabel = [resolvedDate, resolvedTime].filter(Boolean).join(" · ");
  const canPickWinner = !!onWinnerPick && !locked;
  const winnerHome = !!homeTeam && selectedWinnerId === homeTeam.id;
  const winnerAway = !!awayTeam && selectedWinnerId === awayTeam.id;

  return (
    <div className={`score-prediction-card${compact ? " score-prediction-card--compact" : ""}`}>
      {scorePoints > 0 && <div className="score-hit-badge score-prediction-card__hit">+{scorePoints} puntos</div>}
      <div className="score-prediction-card__top">
        <span className="score-prediction-card__phase">{phaseLabel}</span>
        <span className="score-prediction-card__date">{dateTimeLabel || "Fecha"}</span>
      </div>
      {title ? <div className="score-prediction-card__title">{title}</div> : null}
      <div className="score-prediction-card__body">
        <button
          type="button"
          disabled={!canPickWinner || !homeTeam}
          onClick={() => onWinnerPick?.(matchId, homeTeam)}
          className={`score-prediction-card__winner ${winnerHome ? "is-selected" : ""}`}
          aria-label={`Clasifica ${homeTeam?.nombre || "local"}`}
        >
          <TeamCell team={homeTeam} />
        </button>
        <input
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          disabled={locked}
          value={value?.home ?? ""}
          onChange={(event) => onScoreChange(matchId, "home", clampGoal(event.target.value))}
          className="score-prediction-card__score"
          aria-label={`Goles ${homeTeam?.nombre || "local"}`}
        />
        <span className="score-prediction-card__dash">-</span>
        <input
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          disabled={locked}
          value={value?.away ?? ""}
          onChange={(event) => onScoreChange(matchId, "away", clampGoal(event.target.value))}
          className="score-prediction-card__score"
          aria-label={`Goles ${awayTeam?.nombre || "visitante"}`}
        />
        <button
          type="button"
          disabled={!canPickWinner || !awayTeam}
          onClick={() => onWinnerPick?.(matchId, awayTeam)}
          className={`score-prediction-card__winner ${winnerAway ? "is-selected" : ""}`}
          aria-label={`Clasifica ${awayTeam?.nombre || "visitante"}`}
        >
          <TeamCell team={awayTeam} align="right" />
        </button>
      </div>
      {locked ? <div className="score-prediction-card__locked">Prediccion cerrada</div> : null}
    </div>
  );
};

export const ScorePredictionMatchCard = ({
  match,
  schedule,
  value,
  locked,
  onScoreChange,
  onWinnerPick,
  phaseLabel,
  scorePoints,
}: {
  match: Match;
  schedule?: MatchSchedule;
  value?: ScorePrediction;
  locked?: boolean;
  onScoreChange: (matchId: string, side: "home" | "away", value: number | null) => void;
  onWinnerPick?: (matchId: string, team?: Team) => void;
  phaseLabel?: string;
  scorePoints?: number;
}) => (
  <ScorePredictionCard
    matchId={match.id}
    title={`Partido ${match.label || match.id}`}
    phaseLabel={phaseLabel}
    schedule={schedule}
    homeTeam={match.equipoA}
    awayTeam={match.equipoB}
    value={value}
    locked={locked}
    selectedWinnerId={match.ganador?.id}
    onScoreChange={onScoreChange}
    onWinnerPick={onWinnerPick}
    scorePoints={scorePoints}
  />
);
