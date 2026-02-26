import { useRef } from "react";
import type { Team } from "../types";
import thirdsBanner from "../../../assets/ocho-mejores.jpg";
import { ModalFlipFrame } from "./ModalFlipFrame";
import { useHoloPointer } from "../hooks/useHoloPointer";

export const BestThirdsModal = ({
  open,
  onClose,
  thirdsAvailable,
  bestThirdIds,
  maxThird,
  isLocked,
  onToggleTeam,
}: {
  open: boolean;
  onClose: () => void;
  thirdsAvailable: Team[];
  bestThirdIds: string[];
  maxThird: number;
  isLocked: boolean;
  onToggleTeam: (team: Team) => void;
}) => {
  if (!open) return null;
  const overlayRef = useRef<HTMLDivElement>(null);
  const holo = useHoloPointer();
  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start md:items-center justify-center px-4 py-6 overflow-y-auto"
    >
      <ModalFlipFrame className="rounded-lg w-full md:w-1/2 max-w-3xl flex flex-col">
        <div
          ref={holo.ref}
          onPointerEnter={holo.onPointerEnter}
          onPointerMove={holo.onPointerMove}
          onPointerLeave={holo.onPointerLeave}
          className="holo-card border border-neutral-700 modal-glow"
        >
          <div className="holo-surface" aria-hidden="true" />
          <div className="" aria-hidden="true" />
          <div className="holo-glare" aria-hidden="true" />
          <div className="holo-content">
            <div
              className="holo-header  w-full overflow-hidden border-b border-neutral-700 relative"
              style={{ aspectRatio: "16 / 9" }}
            >
              <img src={thirdsBanner} alt="Mejores terceros" className="w-full h-full object-cover" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-2xl font-semibold">Selecciona los 8 mejores terceros</h3>
                <button onClick={onClose} className="text-sm text-gray-900 bg-[#c6f600] hover:text-black rounded-full w-6 h-6 flex items-center justify-center">
                  X
                </button>
              </div>
              <p className="text-xl  text- balance text-gray-400 mb-4">
                El orden en que los selecciones influirá en la fase eliminatoria <span className="text-[#c6f600]">Seleccionados: {bestThirdIds.length}/{maxThird}</span>
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-2 gap-2">
                {thirdsAvailable.map((team) => {
                  const chosen = bestThirdIds.includes(team.id);
                  const position = bestThirdIds.indexOf(team.id) + 1;
                  const locked = !chosen && bestThirdIds.length >= maxThird;
                  const readOnly = isLocked || chosen;
                  return (
                    <button
                      key={team.id}
                      type="button"
                      disabled={locked || readOnly}
                      onClick={() => !readOnly && onToggleTeam(team)}
                      className={`flex items-center justify-between px-3 py-2 rounded-md  text-left ${
                        chosen
                          ? "border-[#c6f600] bg-[#c6f600] text-black"
                          : locked || readOnly
                            ? "border-neutral-800 text-gray-500 opacity-60 cursor-not-allowed"
                            : "border-neutral-700 text-gray-100 hover:border-[#c6f600]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {chosen && (
                          <span className="text-[10px] font-bold text-black bg-[#c6f600] px-2 py-[1px] rounded-full shadow-sm">
                            #{position}
                          </span>
                        )}
                        <div className="relative w-6 h-6 rounded-full overflow-hidden bg-neutral-700">
                          {team.escudo ? (
                            <img
                              src={team.escudo}
                              alt={team.nombre}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-300">
                              {team.codigo}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col max-w-[140px]">
                          <span className="text-sm font-semibold leading-tight whitespace-normal break-words">
                            {team.id}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </ModalFlipFrame>
    </div>
  );
};
