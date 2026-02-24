import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { Match, MatchSchedule, Team } from "../types";
import { getTeamEscudo } from "../utils";

export const RoundBlock = ({
  title,
  matches,
  onPick,
  schedule,
}: {
  title: string;
  matches?: Match[];
  onPick: (matchId: string, team?: Team) => void;
  schedule?: Record<string, MatchSchedule>;
}) => {
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});

  if (!matches || matches.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-sm font-semibold mb-2">{title}</p>
        <p className="text-xs text-gray-400">Completa las llaves previas para habilitar estos cruces.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold">{title}</p>
        <span className="text-[11px] text-gray-400">{matches.length} partidos</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {matches.map((match) => (
          <div
            key={match.id}
            className="bg-neutral-900 rounded-md p-3 border border-neutral-700 flex flex-col gap-2"
          >
            {match.id.startsWith("sf") && (
              <div className="text-[11px] text-gray-500 text-center">
                {match.perdedor ? "Perdedor listo para 3er puesto" : "Define semifinal para tercer puesto"}
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Partido {match.label}</span>
            </div>
            <div className="flex flex-col gap-2">
              {[match.equipoA, match.equipoB].map((team, idx) => {
                const escudo = getTeamEscudo(team);
                return (
                  <button
                    key={`${match.id}-${idx}`}
                    disabled={!team}
                    onClick={() => team && onPick(match.id, team)}
                    className={`flex items-center gap-2 px-2 py-2 rounded-md text-left border ${
                      match.ganador?.id === team?.id
                        ? "bg-[#c6f600] text-black border-[#c6f600]"
                        : "border-neutral-700 text-gray-100"
                    } ${!team ? "opacity-50 cursor-not-allowed" : ""}`}
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
            <button
              type="button"
              onClick={() =>
                setShowDetails((prev) => ({ ...prev, [match.id]: !(prev[match.id] ?? false) }))
              }
              className="text-xs text-gray-300 hover:text-white flex flex-col items-center gap-1"
            >
              <div className="flex flex-wrap items-center justify-center gap-1 text-center">
                <CalendarDays className="w-4 h-4 text-[#c6f600]" />
                {schedule?.[match.label]?.fecha ? (
                  <span className="text-center">
                    {schedule[match.label].fecha}
                    {schedule[match.label].hora ? ` - ${schedule[match.label].hora}` : ""}
                  </span>
                ) : (
                  <span>Calendario: por definir</span>
                )}
                {schedule?.[match.label]?.estadio && (
                  <span>
                    ? {schedule[match.label].estadio}
                    {schedule[match.label].locacion ? ` ? ${schedule[match.label].locacion}` : ""}
                  </span>
                )}
              </div>
              {showDetails[match.id] && schedule?.[match.label]?.homeId && schedule?.[match.label]?.awayId && (
                <span className="text-[11px] text-gray-400">
                  Cruce real: {schedule[match.label].homeId} vs {schedule[match.label].awayId}
                </span>
              )}
            </button>
            {match.ganador && (
              <p className="text-xs text-gray-400">
                Ganador: <span className="text-[#c6f600] font-semibold">{match.ganador.nombre}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
