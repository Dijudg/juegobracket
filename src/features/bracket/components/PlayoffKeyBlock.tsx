import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlayoffMatchData } from "../types";
import { getTeamCode, getTeamEscudo } from "../utils";

export const PlayoffKeyBlock = ({
  title,
  subtitle,
  mapGroup,
  matches,
  onPick,
  disabled,
  showFinalHint,
  scoreByMatchId,
  isMatchLocked,
}: {
  title: string;
  subtitle?: string;
  mapGroup?: string;
  matches: PlayoffMatchData[];
  onPick: (matchId: string, teamCode: string) => void;
  disabled?: boolean;
  showFinalHint?: boolean;
  scoreByMatchId?: Record<string, number | undefined>;
  isMatchLocked?: (matchId: string) => boolean;
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const matchRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [paths, setPaths] = useState<string[]>([]);

  const semiMatches = matches.slice(0, Math.max(0, matches.length - 1));
  const finalMatch = matches[matches.length - 1];

  const setMatchRef = (id: string) => (el: HTMLDivElement | null) => {
    matchRefs.current[id] = el;
  };

  const renderRepechajeMatch = (match?: PlayoffMatchData) => {
    if (!match) return null;
    const scorePoints = scoreByMatchId?.[match.id] || 0;
    const deadlineLocked = !!isMatchLocked?.(match.id);
    const teams = [match.homeTeam, match.awayTeam];
    const isIntercontinentalSemi =
      match.id.startsWith("int-") && match.id.includes("-sf");
    const spacingClass = isIntercontinentalSemi ? "my-6" : "";
    const canPickFinal = !disabled && !deadlineLocked && !!match.homeTeam && !!match.awayTeam;
    const shouldShowFinalHint =
      !!showFinalHint && !!match.highlightFinal && canPickFinal && !match.winnerCode;
    return (
      <div
        ref={setMatchRef(match.id)}
        className={`matchWrap ${shouldShowFinalHint ? "repechaje-final-hint" : ""}`}
      >
        {shouldShowFinalHint && (
          <div className="repechaje-final-hint-label">
            Elige el ganador aquí
            <span className="repechaje-final-hint-arrow" />
          </div>
        )}
        <div className="matchNumber">{match.title}</div>
        {scorePoints > 0 && <div className="score-hit-badge">+{scorePoints} puntos</div>}
        {teams.map((team, idx) => {
          const code = getTeamCode(team);
          const isSelected = !!code && match.winnerCode === code;
          const hardDisabled = disabled || !team || !code;
          const isDisabled = hardDisabled || deadlineLocked;
          const escudo = getTeamEscudo(team);
          return (
            <button
              key={`${match.id}-${idx}`}
              type="button"
              disabled={isDisabled}
              onClick={() => !deadlineLocked && code && onPick(match.id, code)}
              className={`teamBtn ${spacingClass} ${isSelected ? "selected" : ""} ${
                hardDisabled ? "disabled" : ""
              } ${deadlineLocked ? "locked" : ""} ${scorePoints > 0 && isSelected ? "modal-glow score-glow-team" : ""}`}
            >
              <span className="badge">
                {escudo ? (
                  <img src={escudo} alt={team?.nombre} className="badgeImg" />
                ) : (
                  <span className="badgeTxt">{team?.codigo || "--"}</span>
                )}
              </span>
              <span className="code">{team?.nombre || "Por definir"}</span>
            </button>
          );
        })}
        <div className="matchDate">{match.dateLabel || "\u00A0"}</div>
      </div>
    );
  };

  const matchesKey = useMemo(
    () =>
      matches
        .map(
          (m) =>
            `${m.id}:${m.winnerCode || ""}:${getTeamCode(m.homeTeam) || ""}:${getTeamCode(m.awayTeam) || ""}`,
        )
        .join("|"),
    [matches],
  );

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
        const btns = Array.from(el.querySelectorAll("button.teamBtn")) as HTMLElement[];
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
        const dx = Math.max(8, Math.min(20, (x2 - x1) * 0.25));
        return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      };

      const next: string[] = [];
      semiMatches.forEach((semi) => {
        const fromEl = matchRefs.current[semi.id];
        if (!fromEl) return;
        const A = getPorts(fromEl);
        const B = getPorts(finalEl);
        next.push(toPathLR(A.right, A.cy, B.left, B.cy));
      });
      setPaths(next);
    };

    const raf = () => requestAnimationFrame(rebuildPaths);
    raf();
    window.addEventListener("resize", raf);
    return () => window.removeEventListener("resize", raf);
  }, [matchesKey, finalMatch, semiMatches]);

  return (
    <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {mapGroup && <span className="text-[11px] text-gray-400 uppercase">{mapGroup}</span>}
        </div>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>

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

        <div
          className={`repechaje-col repechaje-col--left ${
            semiMatches.length === 1 ? "repechaje-col--single" : ""
          }`}
        >
          {semiMatches.map((match) => (
            <div key={match.id} className="repechaje-slot">
              {renderRepechajeMatch(match)}
            </div>
          ))}
        </div>

        <div className="repechaje-col repechaje-col--right">
          <div className="repechaje-slot">{renderRepechajeMatch(finalMatch)}</div>
        </div>
      </div>
    </div>
  );
};
