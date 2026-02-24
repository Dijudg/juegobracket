import type { Match, MatchSchedule, Team } from "../types";
import { formatFixtureDate, getTeamCode, getTeamEscudo } from "../utils";

export const DieciseisavosCard = ({
  match,
  schedule,
  onPick,
  locked,
}: {
  match: Match;
  schedule?: MatchSchedule;
  onPick: (matchId: string, team?: Team) => void;
  locked?: boolean;
}) => {
  const fechaTexto = schedule?.fecha ? formatFixtureDate(schedule.fecha) : "Por definir";
  const renderTeam = (team?: Team) => {
    const selected = match.ganador?.id === team?.id;
    const disabled = locked || !team;
    const escudo = getTeamEscudo(team);
    const code = getTeamCode(team) || "--";
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !locked && team && onPick(match.id, team)}
        className={`teamBtn ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}
      >
        <span className="badge">
          {escudo ? (
            <img src={escudo} alt={team?.nombre} className="badgeImg" />
          ) : (
            <span className="badgeTxt">{code}</span>
          )}
        </span>
        <span className="code">{team?.nombre || "Por definir"}</span>
      </button>
    );
  };

  return (
    <div className="dieciseisavos-card bg-neutral-800 rounded-lg p-3 border border-neutral-700 mb-2">
      <div className="matchWrap mx-auto">
        <div className="matchNumber">Partido {match.label || match.id}</div>
        {renderTeam(match.equipoA)}
        {renderTeam(match.equipoB)}
        <div className="matchDate">{fechaTexto || "\u00A0"}</div>
      </div>
    </div>
  );
};
