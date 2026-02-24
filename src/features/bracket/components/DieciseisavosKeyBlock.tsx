import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Match, MatchSchedule, Team } from "../types";
import { formatFixtureDate, getTeamCode, getTeamEscudo } from "../utils";

type BlockMatch = {
  match?: Match;
  schedule?: MatchSchedule;
  readOnly?: boolean;
};

export const DieciseisavosKeyBlock = ({
  semiMatches,
  finalMatch,
  finalSchedule,
  onPick,
  locked,
  mirror = false,
  seedLabel,
  onBlockedPick,
}: {
  semiMatches: BlockMatch[];
  finalMatch?: Match;
  finalSchedule?: MatchSchedule;
  onPick: (matchId: string, team?: Team) => void;
  locked?: boolean;
  mirror?: boolean;
  seedLabel?: (team?: Team) => string;
  onBlockedPick?: () => void;
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const matchRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [paths, setPaths] = useState<string[]>([]);

  const setMatchRef = (id: string) => (el: HTMLDivElement | null) => {
    matchRefs.current[id] = el;
  };

  const renderTeam = ({
    team,
    matchId,
    selected,
    readOnly,
    lockedMatch,
  }: {
    team?: Team;
    matchId: string;
    selected: boolean;
    readOnly?: boolean;
    lockedMatch?: boolean;
  }) => {
    const escudo = getTeamEscudo(team);
    const code = getTeamCode(team) || "--";
    if (readOnly) {
      return (
        <div className={`teamBtn readonly ${selected ? "selected" : ""}`}>
          <span className="badge">
            {escudo ? (
              <img src={escudo} alt={team?.nombre} className="badgeImg" />
            ) : (
              <span className="badgeTxt">{code}</span>
            )}
          </span>
          <span className="code">{team?.nombre || "Por definir"}</span>
        </div>
      );
    }

    const hardDisabled = locked || !team;
    const isDisabled = hardDisabled || lockedMatch;
    const seed = seedLabel?.(team);
    const showSeed = !hardDisabled && !lockedMatch && !!seed;
    return (
      <button
        key={`${matchId}-${team?.id || code}`}
        type="button"
        disabled={isDisabled}
        onClick={() => !locked && !lockedMatch && team && onPick(matchId, team)}
        className={`teamBtn ${selected ? "selected" : ""} ${hardDisabled ? "disabled" : ""} ${
          lockedMatch ? "locked" : ""
        }`}
      >
        {showSeed && <span className="seedTag">{seed}</span>}
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

  const renderMatch = ({ match, schedule, readOnly }: BlockMatch) => {
    if (!match) return null;
    const label = match.label || match.id;
    const dateLabel = formatFixtureDate(schedule?.fecha) || "\u00A0";
    const winnerId = match.ganador?.id;
    const matchLocked = !!match.ganador;
    const showBlocked = !!readOnly && !!onBlockedPick;
    return (
      <div
        ref={setMatchRef(match.id)}
        className={`matchWrap${showBlocked ? " matchWrap--blocked" : ""}`}
        onClick={showBlocked ? onBlockedPick : undefined}
        role={showBlocked ? "button" : undefined}
        tabIndex={showBlocked ? 0 : undefined}
        onKeyDown={
          showBlocked
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onBlockedPick?.();
                }
              }
            : undefined
        }
      >
        <div className="matchNumber">Partido {label}</div>
        {renderTeam({
          team: match.equipoA,
          matchId: match.id,
          selected: !!winnerId && winnerId === match.equipoA?.id,
          readOnly,
          lockedMatch: matchLocked,
        })}
        {renderTeam({
          team: match.equipoB,
          matchId: match.id,
          selected: !!winnerId && winnerId === match.equipoB?.id,
          readOnly,
          lockedMatch: matchLocked,
        })}
        <div className="matchDate">{dateLabel}</div>
      </div>
    );
  };

  const matchesKey = useMemo(() => {
    const parts = semiMatches
      .map((m) => m.match)
      .filter(Boolean)
      .map((m) => `${m!.id}:${m!.ganador?.id || ""}:${getTeamCode(m!.equipoA) || ""}:${getTeamCode(m!.equipoB) || ""}`);
    if (finalMatch) {
      parts.push(
        `${finalMatch.id}:${getTeamCode(finalMatch.equipoA) || ""}:${getTeamCode(finalMatch.equipoB) || ""}`,
      );
    }
    return parts.join("|");
  }, [semiMatches, finalMatch]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const rebuildPaths = () => {
      const wrapNow = wrapRef.current;
      if (!wrapNow) return;
      const svg = svgRef.current;
      const w = wrapNow.scrollWidth;
      const h = wrapNow.scrollHeight;
      if (svg) {
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.style.width = `${w}px`;
        svg.style.height = `${h}px`;
      }

      const finalEl = finalMatch ? matchRefs.current[finalMatch.id] : null;
      if (!finalEl) {
        setPaths([]);
        return;
      }

      const wrapRect = wrapNow.getBoundingClientRect();
      const getPorts = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        let cy = r.top - wrapRect.top + r.height / 2;
        const btns = Array.from(el.querySelectorAll(".teamBtn")) as HTMLElement[];
        if (btns.length >= 2) {
          const r1 = btns[0].getBoundingClientRect();
          const r2 = btns[1].getBoundingClientRect();
          const c1 = r1.top + r1.height / 2;
          const c2 = r2.top + r2.height / 2;
          cy = (c1 + c2) / 2 - wrapRect.top;
        }
        return { left: r.left - wrapRect.left, right: r.right - wrapRect.left, cy };
      };

      const toPathLR = (x1: number, y1: number, x2: number, y2: number) => {
        const dx = Math.max(8, Math.min(20, Math.abs(x2 - x1) * 0.25));
        return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      };
      const toPathRL = (x1: number, y1: number, x2: number, y2: number) => {
        const dx = Math.max(8, Math.min(20, Math.abs(x2 - x1) * 0.25));
        return `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;
      };

      const next: string[] = [];
      semiMatches.forEach((semi) => {
        const match = semi.match;
        if (!match) return;
        const fromEl = matchRefs.current[match.id];
        if (!fromEl) return;
        const A = getPorts(fromEl);
        const B = getPorts(finalEl);
        next.push(
          mirror ? toPathRL(A.left, A.cy, B.right, B.cy) : toPathLR(A.right, A.cy, B.left, B.cy),
        );
      });
      setPaths(next);
    };

    const raf = () => requestAnimationFrame(rebuildPaths);
    raf();
    window.addEventListener("resize", raf);
    return () => window.removeEventListener("resize", raf);
  }, [matchesKey, finalMatch, semiMatches]);

  return (
    <div className="bg-neutral-800 rounded-lg  ">
      <div ref={wrapRef} className="repechaje-bracket mx-auto">
        <svg ref={svgRef} className="repechaje-svg" aria-hidden="true">
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--strokeColor)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {mirror ? (
          <>
            <div className="repechaje-col repechaje-col--right">
              <div className="repechaje-slot">
                {renderMatch({ match: finalMatch, schedule: finalSchedule, readOnly: true })}
              </div>
            </div>
            <div className="repechaje-col repechaje-col--left">
              {semiMatches.map((match, idx) => (
                <div key={match.match?.id || idx} className="repechaje-slot">
                  {renderMatch(match)}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="repechaje-col repechaje-col--left">
              {semiMatches.map((match, idx) => (
                <div key={match.match?.id || idx} className="repechaje-slot">
                  {renderMatch(match)}
                </div>
              ))}
            </div>
            <div className="repechaje-col repechaje-col--right">
              <div className="repechaje-slot">
                {renderMatch({ match: finalMatch, schedule: finalSchedule, readOnly: true })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
