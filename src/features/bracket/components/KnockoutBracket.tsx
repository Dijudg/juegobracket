import { Crown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { Match, MatchSchedule, Team } from "../types";
import { getTeamEscudo } from "../utils";
import { BracketConnector } from "./BracketConnector";

export const KnockoutBracket = ({
  r32,
  r16,
  qf,
  sf,
  final,
  thirdPlace,
  onPick,
  seedLabel,
  schedule,
  captureRef,
  captureCode,
  lockFinalSelection,
  navTarget,
  onNavHandled,
  onChampionClick,
  locked = false,
}: {
  r32: Match[];
  r16: Match[];
  qf: Match[];
  sf: Match[];
  final: Match[];
  thirdPlace: Match[];
  onPick: (matchId: string, team?: Team) => void;
  seedLabel: (team?: Team) => string;
  schedule?: Record<string, MatchSchedule>;
  captureRef?: RefObject<HTMLDivElement>;
  captureCode?: string | null;
  lockFinalSelection?: boolean;
  navTarget?: "r32" | "r16" | "qf" | "sf" | "final" | null;
  onNavHandled?: () => void;
  onChampionClick?: (team?: Team) => void;
  locked?: boolean;
}) => {
  const BRACKET_CONSTANTS = {
    matchHeight: 130,
    matchWidth: 80,
    columnGap: 64,
    connectorWidth: 40,
    minWidth: 1200,
    octavosHeight: 672,
    octavosVerticalGap: 48,
    desktopPadding: 32,
    desktopPaddingY: 48,
    mobilePaddingY: 32,
    mobilePaddingX: 8,
    mobileMaxWidth: 448,
    mobileMaxWidthSm: 384,
    mobileOctavosGap: 8,
    mobileCuartosGap: 32,
    mobileSectionGap: 32,
    connectorHeight: 80,
    connectorHeightCuartos: 120,
    connectorHeightSemis: 32,
  };

  const octavos = r16;
  const cuartos = qf;
  const semiLeft = sf.find((m) => m.id === "sf-101");
  const semiRight = sf.find((m) => m.id === "sf-102");
  const semifinales = [semiLeft, semiRight];
  const finalMatch = final[0];
  const thirdMatch = thirdPlace[0];

  const refR16Left = useRef<HTMLDivElement>(null);
  const refR16Right = useRef<HTMLDivElement>(null);
  const refQFLeft = useRef<HTMLDivElement>(null);
  const refQFRight = useRef<HTMLDivElement>(null);
  const refSFLeft = useRef<HTMLDivElement>(null);
  const refSFRight = useRef<HTMLDivElement>(null);
  const refFinal = useRef<HTMLDivElement>(null);

  const mobileWrapRef = useRef<HTMLDivElement | null>(null);
  const mobileSvgRef = useRef<SVGSVGElement | null>(null);
  const mobileMatchRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [mobilePaths, setMobilePaths] = useState<Array<{ d: string; color: string }>>([]);

  const gridWrapRef = useRef<HTMLDivElement>(null);
  const hoverTipRef = useRef<HTMLDivElement | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const hoverPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const attachCaptureRef = (el: HTMLDivElement | null) => {
    if (captureRef) {
      (captureRef as MutableRefObject<HTMLDivElement | null>).current = el;
    }
  };

  const attachGridRef = (el: HTMLDivElement | null) => {
    gridWrapRef.current = el;
  };

  const setMobileMatchRef = (id: string) => (el: HTMLDivElement | null) => {
    mobileMatchRefs.current[id] = el;
  };

  const finalWinner = finalMatch?.ganador;

  const scheduleHoverRender = () => {
    if (hoverRafRef.current !== null) return;
    hoverRafRef.current = window.requestAnimationFrame(() => {
      const tip = hoverTipRef.current;
      if (!tip) {
        hoverRafRef.current = null;
        return;
      }
      const { x, y } = hoverPosRef.current;
      tip.style.setProperty("--tip-x", `${x}px`);
      tip.style.setProperty("--tip-y", `${y}px`);
      hoverRafRef.current = null;
    });
  };

  const showTeamHover = (label: string, event: MouseEvent<HTMLButtonElement>) => {
    const tip = hoverTipRef.current;
    if (!tip) return;
    tip.textContent = label;
    tip.style.display = "block";
    tip.style.opacity = "1";
    hoverPosRef.current = { x: event.clientX, y: event.clientY + 14 };
    scheduleHoverRender();
  };

  const moveTeamHover = (event: MouseEvent<HTMLButtonElement>) => {
    hoverPosRef.current = { x: event.clientX, y: event.clientY + 14 };
    scheduleHoverRender();
  };

  const clearTeamHover = useCallback(() => {
    const tip = hoverTipRef.current;
    if (!tip) return;
    tip.style.opacity = "0";
    tip.style.display = "none";
    if (hoverRafRef.current !== null) {
      window.cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
  }, []);

  const hoverResetKey = useMemo(() => {
    const all = [...r32, ...r16, ...qf, ...sf, ...final, ...thirdPlace];
    return all
      .map(
        (m) =>
          `${m.id}:${m.ganador?.id || ""}:${m.equipoA?.id || ""}:${m.equipoB?.id || ""}`,
      )
      .join("|");
  }, [r32, r16, qf, sf, final, thirdPlace]);

  useEffect(() => {
    clearTeamHover();
  }, [hoverResetKey, locked, lockFinalSelection, clearTeamHover]);

  useLayoutEffect(() => {
    const wrap = mobileWrapRef.current;
    if (!wrap) return;

    const rebuildPaths = () => {
      const wrapNow = mobileWrapRef.current;
      if (!wrapNow) return;
      const rect = wrapNow.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        setMobilePaths([]);
        return;
      }

      const svg = mobileSvgRef.current;
      const w = wrapNow.scrollWidth;
      const h = wrapNow.scrollHeight;
      if (svg) {
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.style.width = `${w}px`;
        svg.style.height = `${h}px`;
      }

      const getPoint = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        const x = r.left - rect.left + r.width / 2;
        const top = r.top - rect.top;
        const bottom = r.bottom - rect.top;
        const center = top + r.height / 2;
        return { x, top, bottom, center };
      };

      const addBracket = (aId?: string, bId?: string, cId?: string, color?: string) => {
        if (!aId || !bId || !cId) return;
        const aEl = mobileMatchRefs.current[aId];
        const bEl = mobileMatchRefs.current[bId];
        const cEl = mobileMatchRefs.current[cId];
        if (!aEl || !bEl || !cEl) return;

        const A = getPoint(aEl);
        const B = getPoint(bEl);
        const C = getPoint(cEl);
        const aboveA = A.center < C.center;
        const aboveB = B.center < C.center;
        const stroke = color || "var(--strokeColor)";

        if (aboveA !== aboveB) {
          if (aboveA) {
            next.push({ d: `M ${A.x} ${A.bottom} L ${A.x} ${C.top}`, color: stroke });
          } else {
            next.push({ d: `M ${A.x} ${A.top} L ${A.x} ${C.bottom}`, color: stroke });
          }
          if (aboveB) {
            next.push({ d: `M ${B.x} ${B.bottom} L ${B.x} ${C.top}`, color: stroke });
          } else {
            next.push({ d: `M ${B.x} ${B.top} L ${B.x} ${C.bottom}`, color: stroke });
          }
          return;
        }

        const sourcesAbove = (A.center + B.center) / 2 < C.center;

        const aY = sourcesAbove ? A.bottom : A.top;
        const bY = sourcesAbove ? B.bottom : B.top;
        const cY = sourcesAbove ? C.top : C.bottom;
        const yJoin = aY + (cY - aY) * 0.5;
        const leftX = Math.min(A.x, B.x);
        const rightX = Math.max(A.x, B.x);

        next.push({ d: `M ${A.x} ${aY} L ${A.x} ${yJoin}`, color: stroke });
        next.push({ d: `M ${B.x} ${bY} L ${B.x} ${yJoin}`, color: stroke });
        next.push({ d: `M ${leftX} ${yJoin} L ${rightX} ${yJoin}`, color: stroke });
        next.push({ d: `M ${C.x} ${yJoin} L ${C.x} ${cY}`, color: stroke });
      };

      const next: Array<{ d: string; color: string }> = [];
      addBracket(octavos[0]?.id, octavos[1]?.id, cuartos[0]?.id);
      addBracket(octavos[2]?.id, octavos[3]?.id, cuartos[1]?.id);
      addBracket(octavos[4]?.id, octavos[5]?.id, cuartos[2]?.id);
      addBracket(octavos[6]?.id, octavos[7]?.id, cuartos[3]?.id);
      addBracket(cuartos[0]?.id, cuartos[1]?.id, semiLeft?.id);
      addBracket(cuartos[2]?.id, cuartos[3]?.id, semiRight?.id);
      addBracket(semiLeft?.id, semiRight?.id, finalMatch?.id, "#facc15");

      setMobilePaths(next);
    };

    const raf = () => requestAnimationFrame(rebuildPaths);
    raf();
    window.addEventListener("resize", raf);
    return () => window.removeEventListener("resize", raf);
  }, [hoverResetKey, octavos, cuartos, semiLeft, semiRight, finalMatch]);

  const resolveMatchNumber = (match?: Match) => {
    if (!match) return "";
    if (match.label) return match.label;
    return match.id || "";
  };

  const TeamButton = ({
    team,
    isWinner,
    onClick,
    disabled,
    onHover,
    onMove,
    onLeave,
  }: {
    team?: Team;
    isWinner: boolean;
    onClick: () => void;
    disabled?: boolean;
    onHover?: (label: string, event: MouseEvent<HTMLButtonElement>) => void;
    onMove?: (event: MouseEvent<HTMLButtonElement>) => void;
    onLeave?: () => void;
  }) => {
    if (!team) {
      return (
        <div className="flex flex-col items-center gap-2 w-10">
          <div className="w-6 h-6 bg-gray-300 rounded-full" />
          <span className="text-sm text-white font-medium">???</span>
        </div>
      );
    }

    const escudo = getTeamEscudo(team);
    const teamId = team.id || "--";
    const teamLabel = team.nombre || teamId;
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={(event) => onHover?.(teamLabel, event)}
        onMouseMove={(event) => onMove?.(event)}
        onMouseLeave={onLeave}
        className={`flex flex-col items-center gap-1 w-10 transition-all ${
          isWinner ? "opacity-100" : "opacity-70 hover:opacity-100"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {escudo ? (
          <img
            src={escudo}
            alt={team.nombre}
            className={`w-6 h-6 object-cover rounded-full shadow-sm ${isWinner ? "border-2 border-[#c6f600]" : ""}`}
          />
        ) : (
          <div className="w-6 h-6  rounded-full" />
        )}
        <span
          className={`text-[10px] font-semibold leading-tight text-center truncate uppercase ${
            isWinner ? "text-[#c6f600] font-bold" : "text-white"
          }`}
        >
          {teamId}
        </span>
      </button>
    );
  };

  const MatchBox = ({
    match,
    date,
    label,
  }: {
    match?: Match;
    date?: string;
    label?: string;
  }) => {
    if (!match) return null;
    const hardLocked = !!locked;
    const teamA = match.equipoA;
    const teamB = match.equipoB;
    const hasWinner = !!match.ganador;
    const canPick = !hardLocked && !hasWinner;

    return (
      <div className="relative flex items-center">
        <div className="relative">
          {label && (
            <div className="absolute -top-7 left-0 right-0 text-center z-10">
              <span className="px-2 py-1 bg-yellow-400 text-gray-900 text-[10px] font-bold rounded shadow-md uppercase">
                {label}
              </span>
            </div>
          )}

          <div
            className={`relative z-[1] flex flex-col items-center gap-1 p-2 rounded-xl w-20 h-20 transition-shadow ${
              hasWinner
                ? "bg-neutral-800 border-2 shadow-lg border transition-colors border-[#c6f600]"
                : "bg-neutral-800 border-full border-gray-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-evenly w-full">
              <TeamButton
                team={teamA}
                isWinner={match.ganador?.id === teamA?.id}
                onClick={() => canPick && teamA && onPick(match.id, teamA)}
                disabled={!canPick || !teamA}
                onHover={showTeamHover}
                onMove={moveTeamHover}
                onLeave={clearTeamHover}
              />
              <TeamButton
                team={teamB}
                isWinner={match.ganador?.id === teamB?.id}
                onClick={() => canPick && teamB && onPick(match.id, teamB)}
                disabled={!canPick || !teamB}
                onHover={showTeamHover}
                onMove={moveTeamHover}
                onLeave={clearTeamHover}
              />
            </div>
            <div className="text-center text-[10px] font-semibold text-[#c6f600] mt-auto">
              Partido {date || "\u00A0"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TrophyWithFlag = ({
    team,
    size,
  }: {
    team?: Team;
    size: "sm" | "lg";
  }) => {
    const escudo = getTeamEscudo(team);
    const isLarge = size === "lg";
    const clickHandler = onChampionClick ? () => onChampionClick(team) : undefined;
    return (
      <div className="flex flex-col items-center gap-2">
        <div
          className={`relative flex items-center justify-center ${isLarge ? "w-16 h-16" : "w-16 h-16"}`}
        >
          <Crown className={`${isLarge ? "w-12 h-12" : "w-10 h-10"} text-yellow-500`} />
          {escudo ? (
            <img
              src={escudo}
              alt={team?.nombre || "Campeón"}
              onClick={clickHandler}
              className={`absolute ${isLarge ? " h-16 modal-glow" : "w-12 h-12"} rounded-full object-cover shadow-md ${onChampionClick ? "cursor-pointer" : ""}`}
            />
          ) : (
            <div
              onClick={clickHandler}
              className={`absolute ${isLarge ? "w-7 h-7" : "w-5 h-5"} rounded-full bg-gray-200 -bottom-1 -right-1 ${onChampionClick ? "cursor-pointer" : ""}`}
            />
          )}
        </div>
        <span className={`${isLarge ? "text-4xl " : "text-lg"} text-white font-black uppercase`}>
          {team?.nombre || "??"}
        </span>
      </div>
    );
  };

  const columnHeightNumber = BRACKET_CONSTANTS.octavosHeight;
  const columnHeight = `${columnHeightNumber}px`;
  const r16ConnectorHeight = columnHeightNumber / 4;
  const qfConnectorHeight = columnHeightNumber / 2;
  const semiConnectorHeight = BRACKET_CONSTANTS.matchHeight * 4;
  const r16ColumnWidth = 150;
  const rightConnectorOffset = -32;

  return (
    <div className="w-full">
      <div ref={attachCaptureRef} className="capture-area">
        {captureCode && <div className="capture-code">Codigo: {captureCode}</div>}

        <div className="hidden lg:block relative">
          <div ref={attachGridRef} className="flex justify-center items-center w-full">
            <div className="relative flex gap-4 items-start">
              <div className="flex gap-4">
                <div
                  ref={refR16Left}
                  className="flex flex-col justify-around"
                  style={{ height: columnHeight, width: r16ColumnWidth, alignItems: "flex-end" }}
                >
                  {octavos.slice(0, 4).map((match, idx) => (
                    <div
                      key={match.id}
                      className="relative"
                      style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}
                    >
                      <div
                        className="absolute inset-0 flex items-center pointer-events-none z-0"
                        style={{ gap: 20 }}
                      >
                        <span
                          className="block"
                          style={{ flex: 1, height: 2, background: "rgba(156, 163, 175, 0.45)" }}
                        />
                        <span
                          className="block"
                          style={{ flex: 1, height: 2, background: "rgba(156, 163, 175, 0.45)" }}
                        />
                      </div>
                      <div className="relative" style={{ zIndex: 1 }}>
                        <MatchBox match={match} date={resolveMatchNumber(match)} />
                        {(idx === 0 || idx === 2) && (
                          <BracketConnector
                            position="bottom"
                            direction="right"
                            height={r16ConnectorHeight}
                            width={BRACKET_CONSTANTS.connectorWidth}
                          />
                        )}
                        {(idx === 1 || idx === 3) && (
                          <BracketConnector
                            position="top"
                            direction="right"
                            height={r16ConnectorHeight}
                            width={BRACKET_CONSTANTS.connectorWidth}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div ref={refQFLeft} className="flex flex-col justify-around" style={{ height: columnHeight }}>
                  {cuartos.slice(0,2).map((match, idx) => (
                    <div key={match.id} className="relative">
                      <MatchBox match={match} date={resolveMatchNumber(match)} />
                      <BracketConnector
                        position={idx === 0 ? "bottom" : "top"}
                        direction="right"
                        height={qfConnectorHeight}
                        width={BRACKET_CONSTANTS.connectorWidth}
                      />
                    </div>
                  ))}
                </div>

                <div ref={refSFLeft} className="flex items-center" style={{ height: columnHeight }}>
                  {semifinales[0] && (
                    <div className="relative">
                      <MatchBox match={semifinales[0]} date={resolveMatchNumber(semifinales[0])} />
                      <BracketConnector
                        position="top"
                        direction="right"
                        height={BRACKET_CONSTANTS.matchHeight * 4}
                        width={BRACKET_CONSTANTS.connectorWidth}
                        type="semifinal"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={refFinal}
                className="flex flex-col items-center justify-center gap-8 px-8"
                style={{ height: columnHeight }}
              >
                <div className="flex flex-col items-center gap-3">
                  <TrophyWithFlag team={finalWinner} size="lg" />
                  <span className="text-3xl text-yellow-800 font-black tracking-wide uppercase">Campeón</span>
                </div>
                {finalMatch && (
                  <div className="my-4">
                    <MatchBox match={finalMatch} date={resolveMatchNumber(finalMatch)} label="FINAL" />
                  </div>
                )}
                {thirdMatch && (
                  <div className="mt-8">
                    <MatchBox
                      match={thirdMatch}
                      date={resolveMatchNumber(thirdMatch)}
                      label="BRONCE"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-8">
                <div ref={refSFRight} className="flex items-center" style={{ height: columnHeight }}>
                  {semifinales[1] && (
                    <div className="relative">
                      <MatchBox match={semifinales[1]} date={resolveMatchNumber(semifinales[1])} />
                      <BracketConnector
                        position="bottom"
                        direction="left"
                        height={BRACKET_CONSTANTS.matchHeight * 4}
                        width={BRACKET_CONSTANTS.connectorWidth}
                        type="semifinal"
                      />
                    </div>
                  )}
                </div>

                <div ref={refQFRight} className="flex flex-col justify-around" style={{ height: columnHeight }}>
                  {cuartos.slice(2, 4).map((match, idx) => (
                    <div key={match.id} className="relative">
                      <MatchBox match={match} date={resolveMatchNumber(match)} />
                      <BracketConnector
                        position={idx === 0 ? "bottom" : "top"}
                        direction="left"
                        height={qfConnectorHeight}
                        width={BRACKET_CONSTANTS.connectorWidth}
                        offsetX={rightConnectorOffset}
                      />
                    </div>
                  ))}
                </div>

                <div
                  ref={refR16Right}
                  className="flex flex-col justify-around"
                  style={{ height: columnHeight, width: r16ColumnWidth, alignItems: "flex-start" }}
                >
                  {octavos.slice(4, 8).map((match, idx) => (
                    <div
                      key={match.id}
                      className="relative"
                      style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}
                    >
                      <div
                        className="absolute inset-0 flex items-center pointer-events-none z-0"
                        style={{ gap: 20 }}
                      >
                        <span
                          className="block"
                          style={{ flex: 1, height: 2, background: "rgba(156, 163, 175, 0.45)" }}
                        />
                        <span
                          className="block"
                          style={{ flex: 1, height: 2, background: "rgba(156, 163, 175, 0.45)" }}
                        />
                      </div>
                      <div className="relative" style={{ zIndex: 1 }}>
                        <MatchBox match={match} date={resolveMatchNumber(match)} />
                        {(idx === 0 || idx === 2) && (
                          <BracketConnector
                            position="bottom"
                            direction="left"
                            height={r16ConnectorHeight}
                            width={BRACKET_CONSTANTS.connectorWidth}
                            offsetX={rightConnectorOffset}
                          />
                        )}
                        {(idx === 1 || idx === 3) && (
                          <BracketConnector
                            position="top"
                            direction="left"
                            height={r16ConnectorHeight}
                            width={BRACKET_CONSTANTS.connectorWidth}
                            offsetX={rightConnectorOffset}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:hidden relative w-full">
          <div ref={mobileWrapRef} className="grid place-items-center items-center py-8 px-2 gap-8 relative">
            <svg ref={mobileSvgRef} className="absolute inset-0 pointer-events-none" aria-hidden="true">
              {mobilePaths.map((path, idx) => (
                <path
                  key={idx}
                  d={path.d}
                  fill="none"
                  stroke={path.color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            {octavos.length > 0 && (
              <div className="w-full max-w-md">
                <div className="grid grid-cols-4 gap-2 place-items-center relative">
                  {octavos.slice(0, 4).map((match, idx) => (
                    <div key={match.id} ref={setMobileMatchRef(match.id)} className="grid place-items-center relative">
                      <MatchBox match={match} date={resolveMatchNumber(match)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cuartos.length > 0 && (
              <div className="w-full max-w-sm">
                <div className="grid grid-cols-2 gap-8 place-items-center relative">
                  {cuartos.slice(0, 2).map((match, idx) => (
                    <div key={match.id} ref={setMobileMatchRef(match.id)} className="grid place-items-center relative">
                      <MatchBox match={match} date={resolveMatchNumber(match)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {semifinales[0] && (
              <div ref={setMobileMatchRef(semifinales[0].id)} className="grid place-items-center relative">
                <MatchBox match={semifinales[0]} date={resolveMatchNumber(semifinales[0])} />
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 items-center w-full max-w-md">
              <div className="grid place-items-center">
                {thirdMatch && (
                  <MatchBox
                    match={thirdMatch}
                    date={resolveMatchNumber(thirdMatch)}
                    label="BRONCE"
                  />
                )}
              </div>
              <div
                ref={finalMatch ? setMobileMatchRef(finalMatch.id) : undefined}
                className="grid place-items-center relative"
              >
                {finalMatch && (
                  <MatchBox match={finalMatch} date={resolveMatchNumber(finalMatch)} label="FINAL" />
                )}
              </div>
              <div className="grid place-items-center">
                <TrophyWithFlag team={finalWinner} size="sm" />
              </div>
            </div>

            {semifinales[1] && (
              <div ref={setMobileMatchRef(semifinales[1].id)} className="grid place-items-center relative">
                <MatchBox match={semifinales[1]} date={resolveMatchNumber(semifinales[1])} />
              </div>
            )}

            {cuartos.length > 2 && (
              <div className="w-full max-w-sm">
                <div className="grid grid-cols-2 gap-8 place-items-center relative">
                  {cuartos.slice(2, 4).map((match, idx) => (
                    <div key={match.id} ref={setMobileMatchRef(match.id)} className="grid place-items-center relative">
                      <MatchBox match={match} date={resolveMatchNumber(match)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {octavos.length > 4 && (
              <div className="w-full max-w-md">
                <div className="grid grid-cols-4 gap-2 place-items-center relative">
                  {octavos.slice(4, 8).map((match, idx) => (
                    <div key={match.id} ref={setMobileMatchRef(match.id)} className="grid place-items-center relative">
                      <MatchBox match={match} date={resolveMatchNumber(match)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        ref={hoverTipRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          transform: "translate3d(var(--tip-x), var(--tip-y), 0) translateX(-50%)",
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          padding: "4px 8px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.2,
          pointerEvents: "none",
          zIndex: 9999,
          whiteSpace: "nowrap",
          boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
          display: "none",
          opacity: 0,
          willChange: "transform",
        }}
      />
    </div>
  );
};

