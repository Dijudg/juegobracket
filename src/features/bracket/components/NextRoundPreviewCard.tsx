import IsotipoAzul from "../../../components/IsotipoAzul";
import type { Match } from "../types";
import { getTeamEscudo } from "../utils";

export const NextRoundPreviewCard = ({ match }: { match?: Match }) => {
  if (!match?.equipoA || !match?.equipoB) return null;
  const homeEscudo = getTeamEscudo(match.equipoA);
  const awayEscudo = getTeamEscudo(match.equipoB);
  return (
    <div className="bg-neutral-900 rounded-md px-4 py-2 gap-2 flex flex-col text-white border border-neutral-800">
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span>Siguiente cruce (Octavos)</span>
        <span>Partido {match.label}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative rounded-full shrink-0 w-[30px] h-[30px] bg-neutral-800">
            {homeEscudo ? (
              <img
                alt={match.equipoA.nombre}
                className="absolute inset-0 w-[30px] h-[30px] rounded-full object-cover"
                src={homeEscudo}
              />
            ) : (
              <IsotipoAzul />
            )}
          </div>
          <span className="text-sm font-semibold">{match.equipoA.nombre}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">VS</span>
        </div>
        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="text-sm font-semibold">{match.equipoB.nombre}</span>
          <div className="relative rounded-full shrink-0 w-[30px] h-[30px] bg-neutral-800">
            {awayEscudo ? (
              <img
                alt={match.equipoB.nombre}
                className="absolute inset-0 w-[30px] h-[30px] rounded-full object-cover"
                src={awayEscudo}
              />
            ) : (
              <IsotipoAzul />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
