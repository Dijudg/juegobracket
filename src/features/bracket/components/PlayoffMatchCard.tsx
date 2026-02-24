import type { Team } from "../types";
import { getTeamCode, getTeamEscudo } from "../utils";

export const PlayoffMatchCard = ({
  matchId,
  title,
  dateLabel,
  locationLabel,
  homeTeam,
  awayTeam,
  winnerCode,
  onPick,
  highlightFinal,
  disabled,
}: {
  matchId: string;
  title: string;
  dateLabel?: string;
  locationLabel?: string;
  homeTeam?: Team;
  awayTeam?: Team;
  winnerCode?: string;
  onPick: (matchId: string, teamCode: string) => void;
  highlightFinal?: boolean;
  disabled?: boolean;
}) => {
  const teams = [homeTeam, awayTeam];
  const isFinal = !!highlightFinal;
  const winnerLabel = winnerCode
    ? getTeamCode(homeTeam) === winnerCode
      ? homeTeam?.nombre
      : getTeamCode(awayTeam) === winnerCode
        ? awayTeam?.nombre
        : winnerCode
    : undefined;
  return (
    <div
      className={`rounded-lg border p-3 bg-neutral-900 flex flex-col gap-2 ${
        isFinal
          ? "border-[#c6f600] shadow-[0_0_24px_rgba(198,246,0,0.25)] ring-1 ring-[#c6f600]/60"
          : "border-neutral-700"
      }`}
    >
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{title}</span>
        {dateLabel && (
          <span className="text-[10px] uppercase tracking-wide">{dateLabel}</span>
        )}
      </div>
      {locationLabel && <p className="text-[11px] text-gray-500">{locationLabel}</p>}
      <div className="flex flex-col gap-2">
        {teams.map((team, idx) => {
          const code = getTeamCode(team);
          const isSelected = !!code && winnerCode === code;
          const isDisabled = disabled || !team || !code;
          const escudo = getTeamEscudo(team);
          return (
            <button
              key={`${matchId}-${idx}`}
              type="button"
              disabled={isDisabled}
              onClick={() => code && onPick(matchId, code)}
              className={`flex items-center gap-2 px-2 py-2 rounded-md text-left border ${
                isSelected ? "bg-[#c6f600] text-black border-[#c6f600]" : "border-neutral-700 text-gray-100"
              } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="relative w-7 h-7 rounded-full overflow-hidden bg-neutral-700">
                {escudo ? (
                  <img
                    src={escudo}
                    alt={team.nombre}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                    {team?.codigo || "--"}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold truncate max-w-[160px]">
                  {team?.nombre || "Por definir"}
                </span>
                <span className="text-[11px] text-gray-400 uppercase">{team?.codigo || "--"}</span>
              </div>
            </button>
          );
        })}
      </div>
      {winnerCode && (
        <p className="text-xs text-gray-400">
          Ganador: <span className="text-[#c6f600] font-semibold">{winnerLabel || winnerCode}</span>
        </p>
      )}
    </div>
  );
};
