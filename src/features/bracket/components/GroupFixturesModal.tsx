import { Calendar, Clock } from "lucide-react";
import { useRef } from "react";
import IsotipoAzul from "../../../components/IsotipoAzul";
import fixturesBanner from "../../../assets/mundial.jpg";
import type { Fixture, Team } from "../types";
import { formatFixtureDate, getTeamEscudo } from "../utils";
import { ModalFlipFrame } from "./ModalFlipFrame";

export const GroupFixturesModal = ({
  open,
  onClose,
  fixtures,
  group,
  resolveTeamById,
}: {
  open: boolean;
  onClose: () => void;
  fixtures: Fixture[];
  group?: string;
  resolveTeamById?: (id?: string) => Team | undefined;
}) => {
  if (!open) return null;
  const overlayRef = useRef<HTMLDivElement>(null);
  const normalizedGroup = group?.toUpperCase() || "";
  const resolveTeam = (id?: string) => {
    if (!id) return resolveTeamById?.(id);
    return resolveTeamById?.(id.toUpperCase()) || resolveTeamById?.(id);
  };

  const list = fixtures
    .filter((f) => {
      const fxGroup = f.group?.toUpperCase();
      if (fxGroup) return fxGroup === normalizedGroup;
      const homeGroup = resolveTeam(f.homeId)?.grupo?.toUpperCase();
      const awayGroup = resolveTeam(f.awayId)?.grupo?.toUpperCase();
      if (homeGroup && awayGroup && homeGroup === awayGroup) return homeGroup === normalizedGroup;
      if (homeGroup === normalizedGroup) return true;
      if (awayGroup === normalizedGroup) return true;
      return false;
    })
    .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4"
    >
      <ModalFlipFrame className="bg-neutral-900 border border-neutral-700 rounded-lg w-full md:w-1/2 max-w-3xl shadow-lg max-h-[80vh] flex flex-col overflow-hidden modal-glow">
        <div className="w-full overflow-hidden border-b border-neutral-700" style={{ aspectRatio: "16 / 9" }}>
          <img src={fixturesBanner} alt="Partidos del grupo" className="w-full h-full object-cover object-bottom" />
        </div>
        <div className="p-4 flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          <div className="flex items-center justify-center mb-3 relative">
            <p className="text-lg font-semibold text-[#c6f600] text-center">Partidos del Grupo {group}</p>
            <button
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-white absolute right-0 top-1/2 -translate-y-1/2"
            >
              Cerrar
            </button>
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-gray-400">No hay partidos disponibles para este grupo.</p>
          ) : (
            <div className="flex flex-col gap-2 pr-1">
              {list.map((fx) => {
                const local = resolveTeam(fx.homeId);
                const visita = resolveTeam(fx.awayId);
                const estadioTexto =
                  fx.estadio || fx.locacion
                    ? `${fx.estadio || "Estadio por definir"}${fx.locacion ? ` - ${fx.locacion}` : ""}`
                    : "Estadio por definir";
                const horaTexto = fx.hora || "Por definir";
                return (
                  <div
                    key={fx.id}
                    className="bg-neutral-100 rounded-md px-4 py-2 gap-2 flex flex-col text-black mb-2"
                  >
                    <div className="flex items-center justify-center gap-3 text-sm whitespace-nowrap">
                      <span className="flex flex-row items-center gap-1 text-neutral-700 whitespace-nowrap">
                        <Calendar className="w-4 h-4 text-gray-600 shrink-0" />
                        {formatFixtureDate(fx.fecha)}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="flex flex-row items-center gap-1 text-neutral-700 whitespace-nowrap">
                        <Clock className="w-4 h-4 text-gray-600 shrink-0" />
                        {horaTexto}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="relative rounded-full shrink-0 w-[30px] h-[30px]">
                          {getTeamEscudo(local) ? (
                            <img
                              alt={local.nombre}
                              className="absolute inset-0 w-[30px] h-[30px] rounded-full object-cover"
                              src={getTeamEscudo(local)}
                            />
                          ) : (
                            <IsotipoAzul />
                          )}
                        </div>
                        <span className="text-black font-medium">{local?.nombre || fx.homeId || "Por definir"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">VS</span>
                      </div>
                      <div className="flex items-center gap-3 flex-1 justify-end">
                        <span className="text-black font-medium">{visita?.nombre || fx.awayId || "Por definir"}</span>
                        <div className="relative rounded-full shrink-0 w-[30px] h-[30px]">
                          {getTeamEscudo(visita) ? (
                            <img
                              alt={visita.nombre}
                              className="absolute inset-0 w-[30px] h-[30px] rounded-full object-cover"
                              src={getTeamEscudo(visita)}
                            />
                          ) : (
                            <IsotipoAzul />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
                      <span>{fx.jornada ? `Jornada ${fx.jornada}` : "Jornada por definir"}</span>
                      <span className="text-right">{estadioTexto}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalFlipFrame>
    </div>
  );
};
