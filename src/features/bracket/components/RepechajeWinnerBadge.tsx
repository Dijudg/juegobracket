import type { Team } from "../types";
import { getTeamEscudo } from "../utils";

export const RepechajeWinnerBadge = ({ label, team }: { label: string; team?: Team }) => {
  const escudo = getTeamEscudo(team);
  const normalizedLabel = label.startsWith("Winner")
    ? `Clasificado al grupo ${label.replace("Winner", "")}`
    : label;
  return (
    <div className="flex items-center justify-center gap-4 p-2">
      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-neutral-700">
        {escudo ? (
          <img src={escudo} alt={team?.nombre || label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xl text-gray-300">
            {team?.codigo || "-"}
          </span>
        )}
      </div>
      <span className="text-base text-gray-200">
        {normalizedLabel}: {team?.nombre || team?.codigo || "Por definir"}
      </span>
    </div>
  );
};
