import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Header from "../components/header";
import Footer from "../components/Footer";
import StickyNav from "../components/StickyNav";
import AdBannerMedium from "../components/AdBannerMedium";
import AdBannerMedium2 from "../components/AdBannerMedium2";
import PartidoCard, { type Partido } from "../components/PartidoCard";
import CalendarNoMatchContent from "../components/CalendarNoMatchContent";
import { KnockoutBracket } from "../components/finales/KnockoutBracket";
import { DieciseisavosKeyBlock } from "../components/finales/DieciseisavosKeyBlock";
import SeccionEnVivo from "../imports/SeccionEnVivo";
import type { Match, MatchSchedule, Team } from "../components/types";
import { useNavigation } from "../contexts/NavigationContext";
import {
  formatResultsMatchDate,
  getResultsHubData,
  type ResultsFeaturedPlayer,
  type ResultsMatchItem,
  type ResultsTopScorer,
} from "../services/resultsHub";
import { buildPlayerSlug } from "../services/worldCupPlayers";
import {
  getWorldCupStandings,
  type WorldCupStandingGroup,
  type WorldCupStandingTeam,
} from "../services/worldCupStandings";
import { getLocalFlagUrl } from "../utils/flags";
import { isCalendarMatchFinished, isCalendarMatchLive } from "../utils/matchStatus";
import { LIVE_DATA_REFRESH_INTERVAL_MS } from "../utils/liveData";
import fifaCupImage from "../assets/fifa-cup.png";
import { formatEcuadorDateTime, getEcuadorDateKey } from "../utils/ecuadorTime";
import { resolveTeamSelectionId } from "../utils/selectionNavigation";
import { getOfficialWorldCupKnockoutMatchNumber } from "../utils/worldCupKnockoutPhases";
import { getNewsFeed } from "../services/newsFeed";

type MainTab = "worldcup" | "friendly";
type WorldCupTab = "groups" | "r32" | "knockout";

interface ResultsNewsItem {
  id: string;
  titulo: string;
  extracto: string;
  imagen: string;
  fecha: string;
  link: string;
}

const UNKNOWN_FLAG_URL = `${import.meta.env.BASE_URL}flags/unknown.svg`;

function ResultsTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`results-tab-button ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}

function ResultsMatchCard({
  match,
  onClick,
}: {
  match: ResultsMatchItem;
  onClick: () => void;
}) {
  const { navigateTo } = useNavigation();
  const partido = buildPartidoFromResultsMatch(match);

  return (
    <PartidoCard
      partido={partido}
      horaActual={new Date()}
      onMatchClick={onClick}
      onTeamClick={(team) => {
        void resolveTeamSelectionId(team).then((selectionId) => {
          if (!selectionId) return;
          navigateTo("seleccion-detail", { id: selectionId });
        });
      }}
    />
  );
}

function buildPartidoFromResultsMatch(match: ResultsMatchItem): Partido {
  return {
    id: match.id,
    fecha: formatResultsMatchDate(match),
    hora: match.modalData.hora,
    estadio: match.subgroupLabel
      ? [match.modalData.estadio, match.subgroupLabel].filter(Boolean).join(" - ")
      : match.modalData.estadio || "Estadio por confirmar",
    equipo1: {
      nombre: match.modalData.equipoLocal.nombre || "Por definir",
      bandera: match.modalData.equipoLocal.bandera,
      codigo: match.modalData.equipoLocal.codigo || "",
    },
    equipo2: {
      nombre: match.modalData.equipoVisitante.nombre || "Por definir",
      bandera: match.modalData.equipoVisitante.bandera,
      codigo: match.modalData.equipoVisitante.codigo || "",
    },
    fase: match.phaseLabel || match.competitionLabel,
    timestamp: match.timestamp,
    gol_local: match.modalData.golLocal,
    gol_visita: match.modalData.golVisita,
    penales_local: match.modalData.penalesLocal,
    penales_visita: match.modalData.penalesVisita,
    status: match.modalData.status,
    calendarType: match.modalData.calendarType,
  };
}

function formatFinishedDayLabel(timestamp: number) {
  if (!timestamp) return "Fecha por confirmar";
  return formatEcuadorDateTime(timestamp, "es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getResultsMatchDateKey(timestamp: number) {
  return getEcuadorDateKey(timestamp);
}

function getLatestResultsDateKey(matches: ResultsMatchItem[]) {
  return matches.reduce((latest, match) => {
    const key = getResultsMatchDateKey(match.timestamp);
    if (!key) return latest;
    return !latest || key > latest ? key : latest;
  }, "");
}

function isFinishedResultsMatch(match: ResultsMatchItem, now: Date) {
  return isCalendarMatchFinished(buildPartidoFromResultsMatch(match), now);
}

function isLiveResultsMatch(match: ResultsMatchItem, now: Date) {
  return isCalendarMatchLive(buildPartidoFromResultsMatch(match), now);
}

function ResultsFinishedCarousel({
  eyebrow,
  title,
  matches,
  onMatchClick,
}: {
  eyebrow: string;
  title: string;
  matches: ResultsMatchItem[];
  onMatchClick: (match: ResultsMatchItem) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const latestFinishedDay = useMemo(() => {
    const finishedMatches = matches
      .filter((match) => isFinishedResultsMatch(match, now))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (!finishedMatches.length) {
      return {
        timestamp: 0,
        items: [] as ResultsMatchItem[],
      };
    }

    const latestDateKey = getResultsMatchDateKey(finishedMatches[0].timestamp);
    return {
      timestamp: finishedMatches[0].timestamp,
      items: finishedMatches
        .filter((match) => getResultsMatchDateKey(match.timestamp) === latestDateKey)
        .sort((a, b) => a.timestamp - b.timestamp),
    };
  }, [matches, now]);

  if (!latestFinishedDay.items.length) {
    return null;
  }

  return (
    <div className="results-surface results-finished-carousel">
      <div className="results-finished-carousel__header">
        <div className="min-w-0">
          <p className="results-surface__eyebrow">{eyebrow}</p>
          <h2 className="results-finished-carousel__title">{title}</h2>
          <p className="results-finished-carousel__subtitle">
            {formatFinishedDayLabel(latestFinishedDay.timestamp)}
          </p>
        </div>

        <div className="results-finished-carousel__controls">
          <button
            type="button"
            className="results-finished-carousel__arrow is-left"
            onClick={() =>
              scrollRef.current?.scrollBy({ left: -360, behavior: "smooth" })
            }
            aria-label="Ver resultados anteriores"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="results-finished-carousel__arrow"
            onClick={() =>
              scrollRef.current?.scrollBy({ left: 360, behavior: "smooth" })
            }
            aria-label="Ver resultados siguientes"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="results-finished-carousel__track">
        {latestFinishedDay.items.map((match) => (
          <div key={`finished-${match.id}`} className="results-finished-carousel__item">
            <ResultsMatchCard
              match={match}
              onClick={() => onMatchClick(match)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="results-empty-state">{children}</div>;
}

function FeaturedPlayerCard({
  featuredPlayer,
  onClick,
}: {
  featuredPlayer: ResultsFeaturedPlayer | null;
  onClick?: () => void;
}) {
  return (
    <div
      className="results-featured-card"
      role={featuredPlayer && onClick ? "button" : undefined}
      tabIndex={featuredPlayer && onClick ? 0 : undefined}
      onClick={featuredPlayer && onClick ? onClick : undefined}
      onKeyDown={
        featuredPlayer && onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={featuredPlayer && onClick ? { cursor: "pointer" } : undefined}
    >
      <p className="results-featured-card__eyebrow">Jugador de la fecha</p>
      {featuredPlayer ? (
        <div className="results-featured-card__body">
          <h2 className="results-featured-card__title">{featuredPlayer.nombre}</h2>
          <p className="results-featured-card__context">{featuredPlayer.contexto}</p>
          <p className="results-featured-card__team">{featuredPlayer.equipo}</p>
        </div>
      ) : (
        <div className="results-featured-card__body">
          <h2 className="results-featured-card__title results-featured-card__title--empty">
            Por definirse
          </h2>
          <p className="results-featured-card__context">
            Se mostrara cuando haya detalle oficial suficiente para destacar al jugador de la fecha.
          </p>
        </div>
      )}
    </div>
  );
}

function TopScorersCard({
  topScorers,
  onPlayerClick,
  limit,
}: {
  topScorers: ResultsTopScorer[];
  onPlayerClick: (player: ResultsTopScorer) => void;
  limit?: number;
}) {
  const visibleTopScorers = typeof limit === "number" ? topScorers.slice(0, limit) : topScorers;

  return (
    <div className="results-surface results-topscorers-card">
      <p className="results-surface__eyebrow">Goleadores del torneo</p>
      {visibleTopScorers.length ? (
        <div className="results-topscorers-card__list">
          {visibleTopScorers.map((player, index) => (
            <button
              key={`${player.nombre}-${index}`}
              type="button"
              onClick={() => onPlayerClick(player)}
              className={`results-scorer-row ${
                index < 3 ? `results-scorer-row--podium-${index + 1}` : ""
              }`}
            >
              <div className="results-scorer-row__meta">
                <div className="results-scorer-row__crest">
                  {player.escudoUrl ? (
                    <img
                      src={player.escudoUrl}
                      alt={player.seleccion}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="results-scorer-row__name">{player.nombre}</p>
                  <p className="results-scorer-row__team">
                    {player.seleccion}
                    {player.posicion ? ` - ${player.posicion}` : ""}
                  </p>
                </div>
              </div>
              <span className="results-scorer-row__goals">{player.goles}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="results-topscorers-card__empty">Todavia no hay goleadores cargados.</p>
      )}
    </div>
  );
}

function BestThirdPlacedTeamsCard({
  teams,
  onTeamClick,
}: {
  teams: Array<WorldCupStandingTeam & { groupName: string }>;
  onTeamClick: (team: WorldCupStandingTeam) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!teams.length) {
    return null;
  }

  const visibleTeams = teams.slice(0, expanded ? 8 : 5);

  return (
    <div className="results-surface results-best-thirds-card">
      <p className="results-surface__eyebrow">Mejores terceros</p>
      <div className="results-best-thirds-card__list">
        {visibleTeams.map((team, index) => (
          <button
            key={`${team.groupName}-${team.codigo_fixture}-${index}`}
            type="button"
            onClick={() => onTeamClick(team)}
            className="results-best-third-row"
          >
            <div className="results-best-third-row__rank">{index + 1}</div>
            <div className="results-best-third-row__flag-wrap">
              <img
                src={getStandingFlag(team)}
                alt={team.nombre_seleccion || team.seleccion_id}
                className="results-best-third-row__flag"
              />
            </div>
            <div className="results-best-third-row__copy">
              <p className="results-best-third-row__name">{team.nombre_seleccion || team.seleccion_id}</p>
              <p className="results-best-third-row__meta">
                Grupo {team.groupName} Â· Dif {team.dif} Â· GF {team.gf}
              </p>
            </div>
            <div className="results-best-third-row__points">{team.pts}</div>
          </button>
        ))}
      </div>
      {teams.length > 5 ? (
        <button
          type="button"
          className="results-best-thirds-card__toggle"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      ) : null}
    </div>
  );
}

function ResultsSidebarNews({
  items,
}: {
  items: ResultsNewsItem[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="results-surface results-sidebar-news">
      <p className="results-surface__eyebrow">Noticias del Mundial</p>
      <div className="results-sidebar-news__list">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="results-sidebar-news__item"
          >
            <div className="results-sidebar-news__thumb">
              {item.imagen ? <img src={item.imagen} alt={item.titulo} className="results-sidebar-news__image" /> : null}
            </div>
            <div className="results-sidebar-news__body">
              <p className="results-sidebar-news__date">{item.fecha}</p>
              <h3 className="results-sidebar-news__title">{item.titulo}</h3>
              <p className="results-sidebar-news__excerpt">{item.extracto}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function getStandingMobileLabel(team: WorldCupStandingTeam) {
  return (
    String(team.codigo_fixture || "").trim().toUpperCase() ||
    team.nombre_seleccion ||
    team.seleccion_id ||
    "POR"
  );
}

function getStandingFlag(team: WorldCupStandingTeam) {
  return team.bandera || team.escudo_url || getLocalFlagUrl(team.codigo_fixture) || UNKNOWN_FLAG_URL;
}

function StandingsPanel({
  groups,
  selectedGroup,
  onSelectGroup,
  onTeamClick,
}: {
  groups: WorldCupStandingGroup[];
  selectedGroup: string;
  onSelectGroup: (group: string) => void;
  onTeamClick: (team: WorldCupStandingTeam) => void;
}) {
  const selectedIndex = Math.max(
    0,
    groups.findIndex((group) => group.nombre === selectedGroup),
  );

  if (!groups.length) {
    return <EmptyState>No hay posiciones disponibles.</EmptyState>;
  }

  return (
    <div className="results-surface results-standings-panel">
      <div className="results-standings-panel__inner">
        <div className="results-standings-panel__header">
          <p className="results-surface__eyebrow">Tabla de posiciones</p>
          <div className="results-chip-group">
            {groups.map((group) => (
              <button
                key={group.nombre}
                type="button"
                onClick={() => onSelectGroup(group.nombre)}
                className={`results-chip-button ${
                  group.nombre === selectedGroup ? "is-active" : ""
                }`}
              >
                {group.nombre}
              </button>
            ))}
          </div>
          <h2 className="results-standings-panel__title">
            Grupo {groups[selectedIndex]?.nombre || selectedGroup}
          </h2>
        </div>

        <div className="results-standings-panel__carousel">
          <div
            className="results-standings-panel__track"
            style={{ transform: `translateX(-${selectedIndex * 100}%)` }}
          >
            {groups.map((group, groupIndex) => (
              <div
                key={group.nombre}
                className={`results-standings-panel__slide ${
                  groupIndex === selectedIndex ? "is-active" : ""
                }`}
              >
                <div className="results-standings-table-wrap">
                  <table className="results-standings-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Seleccion</th>
                        <th className="is-points">Pts</th>
                        <th>PJ</th>
                        <th>PG</th>
                        <th>PE</th>
                        <th>PP</th>
                        <th>Dif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.equipos.map((team, index) => (
                        <tr
                          key={`${group.nombre}-${team.codigo_fixture || team.nombre_seleccion}-${index}`}
                          className={index % 2 === 1 ? "standings-row-alt" : ""}
                          onClick={() => onTeamClick(team)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onTeamClick(team);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          style={{ cursor: "pointer" }}
                        >
                          <td>{index + 1}</td>
                          <td>
                            <div className="results-standings-team">
                              <img
                                src={getStandingFlag(team)}
                                alt={team.nombre_seleccion || team.seleccion_id}
                                className="results-standings-team__flag"
                              />
                              <span className="results-standings-team__name results-standings-team__name--mobile">
                                {getStandingMobileLabel(team)}
                              </span>
                              <span className="results-standings-team__name results-standings-team__name--desktop">
                                {team.nombre_seleccion || team.seleccion_id}
                              </span>
                            </div>
                          </td>
                          <td className="is-points">{team.pts}</td>
                          <td>{team.pj}</td>
                          <td>{team.pg}</td>
                          <td>{team.pe}</td>
                          <td>{team.pp}</td>
                          <td>{team.dif}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildBracketTeam(team: CalendarMatchModalData["equipoLocal"]): Team {
  const rawName = String(team.nombre || "").trim();
  const rawCode = String(team.codigo || "")
    .trim()
    .toUpperCase();
  const winnerPlaceholderMatch = rawName.match(
    /ganador(?:\s+de)?\s+partido\s*#?\s*(\d+)/i,
  );
  const loserPlaceholderMatch = rawName.match(
    /perdedor(?:\s+de)?\s+partido\s*#?\s*(\d+)/i,
  );
  const placeholderToken = winnerPlaceholderMatch
    ? `GP${winnerPlaceholderMatch[1]}`
    : loserPlaceholderMatch
      ? `PP${loserPlaceholderMatch[1]}`
    : /^GP\d+$/i.test(rawCode)
      ? rawCode
      : /^PP\d+$/i.test(rawCode)
        ? rawCode
      : "";

  return {
    id: placeholderToken || rawCode || rawName,
    codigo: placeholderToken || team.codigo || rawCode || rawName,
    nombre: placeholderToken || team.nombre,
    grupo: "",
    escudo: team.bandera,
  };
}

function resolveBracketWinner(match: ResultsMatchItem): Team | undefined {
  const localScore = Number(match.modalData.golLocal);
  const awayScore = Number(match.modalData.golVisita);
  const hasScore =
    match.modalData.golLocal !== undefined &&
    match.modalData.golLocal !== "" &&
    match.modalData.golVisita !== undefined &&
    match.modalData.golVisita !== "";

  if (!hasScore) return undefined;

  if (
    match.modalData.penalesLocal !== undefined &&
    match.modalData.penalesLocal !== "" &&
    match.modalData.penalesVisita !== undefined &&
    match.modalData.penalesVisita !== ""
  ) {
    const localPens = Number(match.modalData.penalesLocal);
    const awayPens = Number(match.modalData.penalesVisita);
    if (localPens > awayPens) return buildBracketTeam(match.modalData.equipoLocal);
    if (awayPens > localPens) return buildBracketTeam(match.modalData.equipoVisitante);
  }

  if (localScore > awayScore) return buildBracketTeam(match.modalData.equipoLocal);
  if (awayScore > localScore) return buildBracketTeam(match.modalData.equipoVisitante);
  return undefined;
}

const R32_BRACKET_LAYOUT = [73, 74, 77, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87];
const R16_BRACKET_LAYOUT = [89, 90, 93, 94, 91, 92, 95, 96];
const QF_BRACKET_LAYOUT = [97, 98, 99, 100];
const SF_BRACKET_LAYOUT = [101, 102];
const R32_TO_R16_BLOCKS = [
  { id: "r32-block-89", source: [74, 77], target: 89 },
  { id: "r32-block-90", source: [73, 75], target: 90 },
  { id: "r32-block-91", source: [76, 78], target: 91 },
  { id: "r32-block-92", source: [79, 80], target: 92 },
  { id: "r32-block-93", source: [83, 84], target: 93 },
  { id: "r32-block-94", source: [81, 82], target: 94 },
  { id: "r32-block-95", source: [86, 88], target: 95 },
  { id: "r32-block-96", source: [85, 87], target: 96 },
] as const;

function mapBracketMatches(
  matches: ResultsMatchItem[],
  ids: string[],
  startLabel: number,
  officialOrder?: number[],
): Match[] {
  const orderedMatches = officialOrder?.length
    ? officialOrder
        .map((number) =>
          matches.find(
            (match) => getOfficialWorldCupKnockoutMatchNumber(match) === number,
          ),
        )
        .filter((match): match is ResultsMatchItem => Boolean(match))
    : [...matches].sort((a, b) => {
        const aNumber = getOfficialWorldCupKnockoutMatchNumber(a) ?? Number.MAX_SAFE_INTEGER;
        const bNumber = getOfficialWorldCupKnockoutMatchNumber(b) ?? Number.MAX_SAFE_INTEGER;
        if (aNumber !== bNumber) return aNumber - bNumber;
        return a.timestamp - b.timestamp;
      });

  return orderedMatches.map((match, index) => ({
    id:
      ids[index] ||
      `${getOfficialWorldCupKnockoutMatchNumber(match) || startLabel + index}`,
    externalId: match.externalId || match.id,
    label: String(getOfficialWorldCupKnockoutMatchNumber(match) || startLabel + index),
    equipoA: buildBracketTeam(match.modalData.equipoLocal),
    equipoB: buildBracketTeam(match.modalData.equipoVisitante),
    ganador: resolveBracketWinner(match),
    status: match.modalData.status,
    timestamp: match.timestamp,
  }));
}

function buildKnockoutBracket(worldCupMatches: ResultsMatchItem[]) {
  const byPhase = (phaseKey: string) =>
    worldCupMatches
      .filter((match) => match.phaseKey === phaseKey)
      .sort((a, b) => a.timestamp - b.timestamp);

  const r32 = mapBracketMatches(
    byPhase("r32"),
    Array.from({ length: 16 }, (_, index) => `r32-${73 + index}`),
    73,
    R32_BRACKET_LAYOUT,
  );
  const r16 = mapBracketMatches(
    byPhase("octavos"),
    Array.from({ length: 8 }, (_, index) => `r16-${89 + index}`),
    89,
    R16_BRACKET_LAYOUT,
  );
  const qf = mapBracketMatches(
    byPhase("cuartos"),
    Array.from({ length: 4 }, (_, index) => `qf-${97 + index}`),
    97,
    QF_BRACKET_LAYOUT,
  );
  const sf = mapBracketMatches(
    byPhase("semifinales"),
    ["sf-101", "sf-102"],
    101,
    SF_BRACKET_LAYOUT,
  );
  const thirdPlace = mapBracketMatches(byPhase("tercer-puesto"), ["third-103"], 103);
  const final = mapBracketMatches(byPhase("final"), ["final-104"], 104);

  return { r32, r16, qf, sf, thirdPlace, final };
}

function buildBracketSchedule(
  match?: ResultsMatchItem,
): MatchSchedule | undefined {
  if (!match) return undefined;

  if (match.timestamp) {
    return {
      fecha: new Date(match.timestamp).toISOString(),
    };
  }

  if (match.modalData.fecha) {
    const rawDate = `${match.modalData.fecha}T${
      match.modalData.hora || "00:00"
    }:00`;
    return {
      fecha: rawDate,
    };
  }

  return undefined;
}

function buildR32MiniBrackets(
  r32Matches: Match[],
  r16Matches: Match[],
  r32Source: ResultsMatchItem[],
  r16Source: ResultsMatchItem[],
) {
  const r32ByLabel = new Map(r32Matches.map((match) => [Number(match.label), match]));
  const r16ByLabel = new Map(r16Matches.map((match) => [Number(match.label), match]));
  const r32SourceByLabel = new Map(
    r32Source.map((match) => [getOfficialWorldCupKnockoutMatchNumber(match), match]),
  );
  const r16SourceByLabel = new Map(
    r16Source.map((match) => [getOfficialWorldCupKnockoutMatchNumber(match), match]),
  );

  return R32_TO_R16_BLOCKS.map((block, index) => ({
    id: block.id,
    pair: block.source
      .map((matchNumber) => ({
        match: r32ByLabel.get(matchNumber),
        schedule: buildBracketSchedule(r32SourceByLabel.get(matchNumber)),
        routeId: String(
          r32SourceByLabel.get(matchNumber)?.externalId ||
            r32SourceByLabel.get(matchNumber)?.id ||
            "",
        ),
      }))
      .filter((item) => item.match),
    targetMatch: r16ByLabel.get(block.target),
    targetSchedule: buildBracketSchedule(r16SourceByLabel.get(block.target)),
    targetRouteId: String(
      r16SourceByLabel.get(block.target)?.externalId ||
        r16SourceByLabel.get(block.target)?.id ||
        "",
    ),
    mirror: [91, 92, 95, 96].includes(block.target),
  })).filter((item) => item.pair.length);
}

function groupMatchesByLabel(matches: ResultsMatchItem[], useSubgroup = false) {
  const map = new Map<string, ResultsMatchItem[]>();

  matches.forEach((match) => {
    const key = useSubgroup
      ? match.subgroupLabel || match.phaseLabel || "Partidos"
      : match.phaseLabel || match.subgroupLabel || "Partidos";
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(match);
  });

  return Array.from(map.entries()).map(([label, items]) => ({
    label,
    items: items.sort((a, b) => a.timestamp - b.timestamp),
  }));
}

interface ResultsCalendarDateItem {
  key: string;
  dayLabel: string;
  dayMonthLabel: string;
  fullLabel: string;
  timestamp: number;
  hasMatches: boolean;
}

function buildResultsCalendarDate(date: Date, hasMatches: boolean): ResultsCalendarDateItem {
  const dayLabel = formatEcuadorDateTime(date, "es-EC", { weekday: "short" })
    .replace(".", "")
    .toUpperCase();
  const monthLabel = formatEcuadorDateTime(date, "es-EC", { month: "short" })
    .replace(".", "")
    .toUpperCase();
  const fullLabel = formatEcuadorDateTime(date, "es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    key: getEcuadorDateKey(date),
    dayLabel: `${dayLabel}.`,
    dayMonthLabel: `${formatEcuadorDateTime(date, "es-EC", { day: "numeric" })} ${monthLabel}`,
    fullLabel,
    timestamp: date.getTime(),
    hasMatches,
  };
}

function buildResultsCalendarDates(matches: ResultsMatchItem[], year: number): ResultsCalendarDateItem[] {
  const matchDateKeys = new Set(
    matches
      .map((match) => getResultsMatchDateKey(match.timestamp))
      .filter(Boolean),
  );

  const items: ResultsCalendarDateItem[] = [];
  const current = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  while (current < yearEnd) {
    const key = getResultsMatchDateKey(current.getTime());
    items.push(buildResultsCalendarDate(new Date(current), matchDateKeys.has(key)));
    current.setDate(current.getDate() + 1);
  }

  return items;
}

function getAutoSelectedResultsDate(
  dates: ResultsCalendarDateItem[],
  currentDateKey: string,
) {
  if (!dates.length) return "";

  const todayMatch = dates.find((date) => date.key === currentDateKey);
  if (todayMatch) return todayMatch.key;

  const upcomingMatch = dates.find((date) => date.key > currentDateKey);
  if (upcomingMatch) return upcomingMatch.key;

  return dates[dates.length - 1]?.key || "";
}

function getMatchesForCalendarDate(matches: ResultsMatchItem[], dateKey: string) {
  return matches.filter((match) => {
    if (!match.timestamp) return false;
    const date = new Date(match.timestamp);
    if (Number.isNaN(date.getTime())) return false;

    const matchKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;

    return matchKey === dateKey;
  });
}

function ResultsCalendarPanel({
  eyebrow,
  dates,
  selectedDate,
  onSelectDate,
  matches,
  onMatchClick,
  emptyMessage,
}: {
  eyebrow: string;
  dates: ResultsCalendarDateItem[];
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  matches: ResultsMatchItem[];
  onMatchClick: (match: ResultsMatchItem) => void;
  emptyMessage: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dateRefsMap = useRef<Map<string, HTMLButtonElement>>(new Map());
  const selectedDateMeta = dates.find((date) => date.key === selectedDate) || dates[0] || null;
  const visibleMatches = selectedDateMeta
    ? [...getMatchesForCalendarDate(matches, selectedDateMeta.key)].sort((a, b) => a.timestamp - b.timestamp)
    : [];

  useEffect(() => {
    if (!selectedDateMeta?.key) return;

    const selectedElement = dateRefsMap.current.get(selectedDateMeta.key);
    if (!selectedElement) return;

    const frame = window.requestAnimationFrame(() => {
      selectedElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedDateMeta?.key]);

  if (!dates.length) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -240 : 240,
      behavior: "smooth",
    });
  };

  return (
    <div className="results-surface results-calendar-panel">
      <div className="results-calendar-panel__body">
        <p className="results-surface__eyebrow">{eyebrow}</p>

        <div className="results-calendar-panel__rail">
          <button
            type="button"
            className="results-calendar-panel__arrow is-left"
            onClick={() => handleScroll("left")}
            aria-label="Ver fechas anteriores"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={scrollRef}
            className="results-calendar-panel__dates"
            role="tablist"
            aria-label={eyebrow}
          >
            {dates.map((date) => (
              <button
                key={date.key}
                ref={(element) => {
                  if (element) {
                    dateRefsMap.current.set(date.key, element);
                  } else {
                    dateRefsMap.current.delete(date.key);
                  }
                }}
                type="button"
                onClick={() => onSelectDate(date.key)}
                className={`results-calendar-date ${date.key === selectedDateMeta?.key ? "is-active" : ""} ${
                  date.hasMatches ? "is-has-matches" : "is-no-matches"
                }`}
              >
                <span className="results-calendar-date__day">{date.dayLabel}</span>
                <span className="results-calendar-date__month">{date.dayMonthLabel}</span>
                <span className="results-calendar-date__dot" />
              </button>
            ))}
          </div>

          <button
            type="button"
            className="results-calendar-panel__arrow"
            onClick={() => handleScroll("right")}
            aria-label="Ver fechas siguientes"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="results-calendar-panel__matches">
          <h2 className="results-calendar-panel__title">Partidos del dí­a</h2>
          <p className="results-calendar-panel__subtitle">
            {selectedDateMeta ? selectedDateMeta.fullLabel : "Fecha por confirmar"}
          </p>
        </div>

        {visibleMatches.length ? (
          <div className="results-match-grid">
            {visibleMatches.map((match) => (
              <ResultsMatchCard
                key={match.id}
                match={match}
                onClick={() => onMatchClick(match)}
              />
            ))}
          </div>
        ) : (
          <CalendarNoMatchContent title="No hay partidos programados para esta fecha." />
        )}
      </div>
    </div>
  );
}

export default function ResultadosPage() {
  const [loading, setLoading] = useState(true);
  const [worldCupMatches, setWorldCupMatches] = useState<ResultsMatchItem[]>([]);
  const [friendlyMatches, setFriendlyMatches] = useState<ResultsMatchItem[]>([]);
  const [topScorers, setTopScorers] = useState<ResultsTopScorer[]>([]);
  const [featuredPlayer, setFeaturedPlayer] = useState<ResultsFeaturedPlayer | null>(null);
  const [standingsGroups, setStandingsGroups] = useState<WorldCupStandingGroup[]>([]);
  const [mainTab, setMainTab] = useState<MainTab>("worldcup");
  const [worldCupTab, setWorldCupTab] = useState<WorldCupTab>("groups");
  const [selectedGroup, setSelectedGroup] = useState("A");
  const [selectedFriendlyDate, setSelectedFriendlyDate] = useState("");
  const [selectedR32Date, setSelectedR32Date] = useState("");
  const [selectedR32Branch, setSelectedR32Branch] = useState<"left" | "right">("left");
  const [selectedKnockoutDate, setSelectedKnockoutDate] = useState("");
  const [currentDateKey, setCurrentDateKey] = useState(() => getResultsMatchDateKey(Date.now()));
  const [newsItems, setNewsItems] = useState<ResultsNewsItem[]>([]);
  const { navigateTo } = useNavigation();
  const lastFriendlyDayRef = useRef(currentDateKey);
  const lastR32DayRef = useRef(currentDateKey);
  const lastKnockoutDayRef = useRef(currentDateKey);
  const lastAutoWorldCupTabRef = useRef<WorldCupTab>("groups");
  const finishedCarouselConfig = useMemo(() => {
    if (mainTab === "friendly") {
      return {
        eyebrow: "Cierre de jornada",
        title: "Amistosos: partidos terminados del dia",
        matches: friendlyMatches,
      };
    }

    return {
      eyebrow: "Cierre de jornada",
      title: "Mundial: partidos terminados del dia",
      matches: worldCupMatches,
    };
  }, [friendlyMatches, mainTab, worldCupMatches]);

  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;

    const scheduleNextRefresh = (hasLiveMatches: boolean) => {
      if (cancelled) return;
      if (!hasLiveMatches) return;
      timerId = window.setTimeout(() => {
        void loadResults(false);
      }, LIVE_DATA_REFRESH_INTERVAL_MS);
    };

    const loadResults = async (showLoader: boolean) => {
      if (showLoader && !cancelled) setLoading(true);

      let hasAnyLiveMatch = false;
      try {
        const [resultsData, standingsData] = await Promise.all([
          getResultsHubData(),
          getWorldCupStandings(),
        ]);

        const now = new Date();
        hasAnyLiveMatch = [...resultsData.worldCupMatches, ...resultsData.friendlyMatches].some((match) =>
          isLiveResultsMatch(match, now),
        );

        if (!cancelled) {
          setWorldCupMatches(resultsData.worldCupMatches);
          setFriendlyMatches(resultsData.friendlyMatches);
          setTopScorers(resultsData.topScorers);
          setFeaturedPlayer(resultsData.featuredPlayer);
          setStandingsGroups(standingsData);
        }
      } catch (error) {
        console.error("Error al cargar la pagina de resultados:", error);
        if (!cancelled && showLoader) {
          setWorldCupMatches([]);
          setFriendlyMatches([]);
          setTopScorers([]);
          setFeaturedPlayer(null);
          setStandingsGroups([]);
        }
      } finally {
        if (!cancelled && showLoader) {
          setLoading(false);
        }
        scheduleNextRefresh(hasAnyLiveMatch);
      }
    };

    void loadResults(true);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadNews = async () => {
      try {
        const data = await getNewsFeed(3);
        if (cancelled) return;

        setNewsItems(
          data.map((item) => ({
            id: item.id,
            titulo: item.titulo || "Sin titulo",
            extracto: item.descripcion,
            imagen: item.imagen,
            fecha: item.fechaIso || "",
            link: item.url,
          })),
        );
      } catch (error) {
        console.error("Error al cargar noticias de resultados:", error);
      }
    };

    void loadNews();

    return () => {
      cancelled = true;
    };
  }, []);

  const groupKeys = useMemo(() => {
    const fromMatches = Array.from(
      new Set(
        worldCupMatches
          .filter((match) => match.phaseKey === "groups")
          .map((match) => match.subgroupKey)
          .filter(Boolean) as string[],
      ),
    ).sort();

    if (fromMatches.length) return fromMatches;
    return standingsGroups.map((group) => group.nombre).filter(Boolean);
  }, [standingsGroups, worldCupMatches]);

  useEffect(() => {
    if (!groupKeys.length) return;
    if (!groupKeys.includes(selectedGroup)) {
      setSelectedGroup(groupKeys[0]);
    }
  }, [groupKeys, selectedGroup]);

  useEffect(() => {
    if (mainTab !== "worldcup" || worldCupTab !== "groups" || groupKeys.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setSelectedGroup((current) => {
        const currentIndex = groupKeys.indexOf(current);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % groupKeys.length : 0;
        return groupKeys[nextIndex] || groupKeys[0];
      });
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [groupKeys, mainTab, worldCupTab]);

  const worldCupGroupMatches = useMemo(() => {
    return worldCupMatches.filter(
      (match) => match.phaseKey === "groups" && match.subgroupKey === selectedGroup,
    );
  }, [selectedGroup, worldCupMatches]);

  const finishedWorldCupGroupMatches = useMemo(() => {
    const now = new Date();
    return worldCupGroupMatches.filter((match) => isFinishedResultsMatch(match, now));
  }, [worldCupGroupMatches]);

  const worldCupR32Matches = useMemo(() => {
    return worldCupMatches.filter((match) => match.phaseKey === "r32");
  }, [worldCupMatches]);

  const worldCupR16Matches = useMemo(() => {
    return worldCupMatches.filter((match) => match.phaseKey === "octavos");
  }, [worldCupMatches]);

  const worldCupFinalBracketMatches = useMemo(() => {
    return worldCupMatches.filter((match) =>
      ["octavos", "cuartos", "semifinales", "tercer-puesto", "final"].includes(match.phaseKey),
    );
  }, [worldCupMatches]);
  const worldCupGroupStageMatches = useMemo(
    () => worldCupMatches.filter((match) => match.phaseKey === "groups"),
    [worldCupMatches],
  );
  const latestGroupStageDateKey = useMemo(
    () => getLatestResultsDateKey(worldCupGroupStageMatches),
    [worldCupGroupStageMatches],
  );
  const latestR32DateKey = useMemo(
    () => getLatestResultsDateKey(worldCupR32Matches),
    [worldCupR32Matches],
  );
  const preferredWorldCupTab = useMemo<WorldCupTab>(() => {
    if (!worldCupMatches.length) return "groups";

    if (latestGroupStageDateKey && currentDateKey <= latestGroupStageDateKey) {
      return "groups";
    }

    if (latestR32DateKey && currentDateKey <= latestR32DateKey) {
      return "r32";
    }

    if (worldCupFinalBracketMatches.length) {
      return "knockout";
    }

    if (worldCupR32Matches.length) {
      return "r32";
    }

    return "groups";
  }, [
    currentDateKey,
    latestGroupStageDateKey,
    latestR32DateKey,
    worldCupFinalBracketMatches.length,
    worldCupMatches.length,
    worldCupR32Matches.length,
  ]);

  useEffect(() => {
    if (mainTab !== "worldcup") return;

    if (preferredWorldCupTab !== lastAutoWorldCupTabRef.current) {
      setWorldCupTab(preferredWorldCupTab);
      lastAutoWorldCupTabRef.current = preferredWorldCupTab;
    }
  }, [mainTab, preferredWorldCupTab]);

  const knockoutBracket = useMemo(
    () => buildKnockoutBracket(worldCupMatches),
    [worldCupMatches],
  );
  const r32MiniBrackets = useMemo(
    () =>
      buildR32MiniBrackets(
        knockoutBracket.r32,
        knockoutBracket.r16,
        worldCupR32Matches,
        worldCupR16Matches,
      ),
    [
      knockoutBracket.r16,
      knockoutBracket.r32,
      worldCupR16Matches,
      worldCupR32Matches,
    ],
  );
  const r32MiniBracketsLeft = useMemo(
    () =>
      ["89", "90", "93", "94"]
        .map((label) =>
          r32MiniBrackets.find((block) => (block.targetMatch?.label || "") === label),
        )
        .filter(Boolean),
    [r32MiniBrackets],
  );
  const r32MiniBracketsRight = useMemo(
    () =>
      ["91", "92", "95", "96"]
        .map((label) =>
          r32MiniBrackets.find((block) => (block.targetMatch?.label || "") === label),
        )
        .filter(Boolean),
    [r32MiniBrackets],
  );

  const friendlySections = useMemo(
    () => groupMatchesByLabel(friendlyMatches, true),
    [friendlyMatches],
  );
  const worldCupFinalSections = useMemo(
    () => groupMatchesByLabel(worldCupFinalBracketMatches),
    [worldCupFinalBracketMatches],
  );
  const bestThirdPlacedTeams = useMemo(
    () =>
      standingsGroups
        .map((group) => {
          const thirdPlacedTeam = group.equipos?.[2];
          return thirdPlacedTeam
            ? {
                ...thirdPlacedTeam,
                groupName: group.nombre,
              }
            : null;
        })
        .filter((team): team is WorldCupStandingTeam & { groupName: string } => Boolean(team))
        .sort(
          (left, right) =>
            right.pts - left.pts ||
            right.dif - left.dif ||
            right.gf - left.gf ||
            left.nombre_seleccion.localeCompare(right.nombre_seleccion, "es"),
        )
        .slice(0, 8),
    [standingsGroups],
  );
  const activeCalendarYear = useMemo(
    () => Number(currentDateKey.slice(0, 4)) || new Date().getFullYear(),
    [currentDateKey],
  );
  const friendlyCalendarDates = useMemo(
    () => buildResultsCalendarDates(friendlyMatches, activeCalendarYear),
    [activeCalendarYear, friendlyMatches],
  );
  const r32CalendarDates = useMemo(
    () => buildResultsCalendarDates(worldCupR32Matches, activeCalendarYear),
    [activeCalendarYear, worldCupR32Matches],
  );
  const knockoutCalendarDates = useMemo(
    () => buildResultsCalendarDates(worldCupFinalBracketMatches, activeCalendarYear),
    [activeCalendarYear, worldCupFinalBracketMatches],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDateKey(getResultsMatchDateKey(Date.now()));
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!friendlyCalendarDates.length) {
      setSelectedFriendlyDate("");
      return;
    }

    const targetDate = getAutoSelectedResultsDate(friendlyCalendarDates, currentDateKey);
    const dayChanged = lastFriendlyDayRef.current !== currentDateKey;
    const selectedDateExists = friendlyCalendarDates.some((date) => date.key === selectedFriendlyDate);
    const nextDate = dayChanged
      ? targetDate
      : selectedDateExists
        ? selectedFriendlyDate
        : targetDate;

    if (nextDate && nextDate !== selectedFriendlyDate) {
      setSelectedFriendlyDate(nextDate);
    }

    lastFriendlyDayRef.current = currentDateKey;
  }, [currentDateKey, friendlyCalendarDates, selectedFriendlyDate]);

  useEffect(() => {
    if (!r32CalendarDates.length) {
      setSelectedR32Date("");
      return;
    }

    const targetDate = getAutoSelectedResultsDate(r32CalendarDates, currentDateKey);
    const dayChanged = lastR32DayRef.current !== currentDateKey;
    const selectedDateExists = r32CalendarDates.some((date) => date.key === selectedR32Date);
    const nextDate = dayChanged
      ? targetDate
      : selectedDateExists
        ? selectedR32Date
        : targetDate;

    if (nextDate && nextDate !== selectedR32Date) {
      setSelectedR32Date(nextDate);
    }

    lastR32DayRef.current = currentDateKey;
  }, [currentDateKey, r32CalendarDates, selectedR32Date]);

  useEffect(() => {
    if (!knockoutCalendarDates.length) {
      setSelectedKnockoutDate("");
      return;
    }

    const targetDate = getAutoSelectedResultsDate(knockoutCalendarDates, currentDateKey);
    const dayChanged = lastKnockoutDayRef.current !== currentDateKey;
    const selectedDateExists = knockoutCalendarDates.some((date) => date.key === selectedKnockoutDate);
    const nextDate = dayChanged
      ? targetDate
      : selectedDateExists
        ? selectedKnockoutDate
        : targetDate;

    if (nextDate && nextDate !== selectedKnockoutDate) {
      setSelectedKnockoutDate(nextDate);
    }

    lastKnockoutDayRef.current = currentDateKey;
  }, [currentDateKey, knockoutCalendarDates, selectedKnockoutDate]);

  return (
    <div className="results-page">
      <StickyNav />

      <div className="mx-auto max-w-7xl px-4 py-4">
        <Header />

        <section className="results-page__section">
          <div className="mt-4">
            <AdBannerMedium />
          </div>

          <div className="results-tab-row results-tab-row--primary">
            <ResultsTabButton active={mainTab === "worldcup"} onClick={() => setMainTab("worldcup")}>
              Mundial
            </ResultsTabButton>
            <ResultsTabButton active={mainTab === "friendly"} onClick={() => setMainTab("friendly")}>
              Amistosos
            </ResultsTabButton>
          </div>

          {!loading ? (
            <ResultsFinishedCarousel
              eyebrow={finishedCarouselConfig.eyebrow}
              title={finishedCarouselConfig.title}
              matches={finishedCarouselConfig.matches}
              onMatchClick={(match) => navigateTo("partido", { id: match.id })}
            />
          ) : null}

          {loading ? <EmptyState>Cargando resultados...</EmptyState> : null}

          {!loading && mainTab === "worldcup" ? (
            <div className="results-layout">
              <div className="results-layout__sidebar results-layout__sidebar--desktop">
                <FeaturedPlayerCard
                  featuredPlayer={featuredPlayer}
                  onClick={
                    featuredPlayer?.playerSlug
                      ? () =>
                          navigateTo("jugador-detail", {
                            id: featuredPlayer.playerSlug as string,
                          })
                      : undefined
                  }
                />
                <TopScorersCard
                  topScorers={topScorers}
                  onPlayerClick={(player) =>
                    navigateTo("jugador-detail", {
                      id:
                        player.playerSlug ||
                        buildPlayerSlug(
                          player.nombre,
                          player.seleccionCodigo ||
                            player.seleccion ||
                            "mundial",
                        ),
                    })
                  }
                />
                <BestThirdPlacedTeamsCard
                  teams={bestThirdPlacedTeams}
                  onTeamClick={(team) =>
                    navigateTo("seleccion-detail", {
                      id: team.seleccion_id,
                    })
                  }
                />
                <SeccionEnVivo />
                {worldCupTab !== "groups" ? <ResultsSidebarNews items={newsItems} /> : null}
              </div>

              <div className="results-layout__main">
                <div className="results-surface results-main-panel">
                  <div className="results-main-panel__body">
                    <div className="results-tab-row results-tab-row--phases">
                      <ResultsTabButton active={worldCupTab === "groups"} onClick={() => setWorldCupTab("groups")}>
                        Fase de grupos
                      </ResultsTabButton>
                      <ResultsTabButton active={worldCupTab === "r32"} onClick={() => setWorldCupTab("r32")}>
                        Dieciseisavos
                      </ResultsTabButton>
                      <ResultsTabButton active={worldCupTab === "knockout"} onClick={() => setWorldCupTab("knockout")}>
                        Llaves finales
                      </ResultsTabButton>
                    </div>

                    {worldCupTab === "groups" ? (
                      <div className="results-main-stack">
                        <StandingsPanel
                          groups={standingsGroups}
                          selectedGroup={selectedGroup}
                          onSelectGroup={setSelectedGroup}
                          onTeamClick={(team) =>
                            navigateTo("seleccion-detail", {
                              id: team.seleccion_id,
                            })
                          }
                        />

                        {worldCupGroupMatches.length ? (
                          <div className="results-match-grid">
                            {(finishedWorldCupGroupMatches.length
                              ? finishedWorldCupGroupMatches
                              : worldCupGroupMatches
                            ).map((match) => (
                              <ResultsMatchCard
                                key={match.id}
                                match={match}
                                onClick={() => navigateTo("partido", { id: match.id })}
                              />
                            ))}
                          </div>
                        ) : (
                          <EmptyState>No hay partidos del grupo seleccionado.</EmptyState>
                        )}

                        <div className="results-mobile-stack results-mobile-stack--mobile-only">
                          <TopScorersCard
                            topScorers={topScorers}
                            limit={3}
                            onPlayerClick={(player) =>
                              navigateTo("jugador-detail", {
                                id:
                                  player.playerSlug ||
                                  buildPlayerSlug(
                                    player.nombre,
                                    player.seleccionCodigo ||
                                      player.seleccion ||
                                      "mundial",
                                  ),
                              })
                            }
                          />
                          <FeaturedPlayerCard
                            featuredPlayer={featuredPlayer}
                            onClick={
                              featuredPlayer?.playerSlug
                                ? () =>
                                    navigateTo("jugador-detail", {
                                      id: featuredPlayer.playerSlug as string,
                                    })
                                : undefined
                            }
                          />
                          <SeccionEnVivo />
                        </div>
                      </div>
                    ) : null}

                    {worldCupTab === "r32" ? (
                      <div className="results-main-stack">
                        <div className="results-bracket-wrap bracket-panel">
                          <div className="results-r32-switch" role="tablist" aria-label="Seleccionar llave de dieciseisavos">
                            <button
                              type="button"
                              className={`results-r32-switch__button ${
                                selectedR32Branch === "left" ? "is-active" : ""
                              }`}
                              onClick={() => setSelectedR32Branch("left")}
                              aria-pressed={selectedR32Branch === "left"}
                            >
                              Llave 1
                            </button>
                            <button
                              type="button"
                              className={`results-r32-switch__button ${
                                selectedR32Branch === "right" ? "is-active" : ""
                              }`}
                              onClick={() => setSelectedR32Branch("right")}
                              aria-pressed={selectedR32Branch === "right"}
                            >
                              Llave 2
                            </button>
                          </div>
                          <div className="results-r32-shell">
                            <div className="results-r32-centerpiece-shell" aria-hidden="true">
                              <div className="results-r32-centerpiece">
                                <img
                                  src={fifaCupImage}
                                  alt=""
                                  className="results-r32-centerpiece__image"
                                />
                              </div>
                            </div>
                            <div className="results-r32-grid">
                              <div
                                className={`results-r32-grid__column results-r32-grid__column--left ${
                                  selectedR32Branch === "right"
                                    ? "results-r32-grid__column--mobile-hidden"
                                    : ""
                                }`}
                              >
                                {r32MiniBracketsLeft.map((block) => (
                                  <div key={block.id} className="results-r32-grid__item">
                                    <DieciseisavosKeyBlock
                                      semiMatches={block.pair}
                                      finalMatch={block.targetMatch}
                                      finalSchedule={block.targetSchedule}
                                      finalRouteId={block.targetRouteId}
                                      onMatchClick={(routeId) =>
                                        navigateTo("partido", {
                                          id: routeId,
                                        })
                                      }
                                      mirror={block.mirror}
                                    />
                                  </div>
                                ))}
                              </div>
                              <div
                                className={`results-r32-grid__column results-r32-grid__column--right ${
                                  selectedR32Branch === "left"
                                    ? "results-r32-grid__column--mobile-hidden"
                                    : ""
                                }`}
                              >
                                {r32MiniBracketsRight.map((block) => (
                                  <div key={block.id} className="results-r32-grid__item">
                                    <DieciseisavosKeyBlock
                                      semiMatches={block.pair}
                                      finalMatch={block.targetMatch}
                                      finalSchedule={block.targetSchedule}
                                      finalRouteId={block.targetRouteId}
                                      onMatchClick={(routeId) =>
                                        navigateTo("partido", {
                                          id: routeId,
                                        })
                                      }
                                      mirror={block.mirror}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {worldCupR32Matches.length ? (
                          <ResultsCalendarPanel
                            eyebrow="Calendario de dieciseisavos"
                            dates={r32CalendarDates}
                            selectedDate={selectedR32Date}
                            onSelectDate={setSelectedR32Date}
                            matches={worldCupR32Matches}
                            onMatchClick={(match) => navigateTo("partido", { id: match.id })}
                            emptyMessage="No hay dieciseisavos cargados todavia."
                          />
                        ) : (
                          <EmptyState>No hay dieciseisavos cargados todavia.</EmptyState>
                        )}
                      </div>
                    ) : null}

                    {worldCupTab === "knockout" ? (
                      <div className="results-main-stack">
                        <div className="results-bracket-wrap bracket-panel">
                          <KnockoutBracket
                            r32={knockoutBracket.r32}
                            r16={knockoutBracket.r16}
                            qf={knockoutBracket.qf}
                            sf={knockoutBracket.sf}
                            final={knockoutBracket.final}
                            thirdPlace={knockoutBracket.thirdPlace}
                            onPick={() => {}}
                            seedLabel={() => ""}
                            locked
                            highlightFinalMatch
                            onMatchClick={(match) => {
                              const targetId = match.externalId || match.id;
                              navigateTo("partido", { id: targetId });
                            }}
                          />
                        </div>

                        {worldCupFinalSections.length ? (
                          <ResultsCalendarPanel
                            eyebrow="Calendario de llaves finales"
                            dates={knockoutCalendarDates}
                            selectedDate={selectedKnockoutDate}
                            onSelectDate={setSelectedKnockoutDate}
                            matches={worldCupFinalBracketMatches}
                            onMatchClick={(match) => navigateTo("partido", { id: match.id })}
                            emptyMessage="No hay llaves finales cargadas todavia."
                          />
                        ) : (
                          <EmptyState>No hay llaves finales cargadas todavia.</EmptyState>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!loading && mainTab === "friendly" ? (
            friendlySections.length ? (
              <ResultsCalendarPanel
                eyebrow="Calendario de amistosos"
                dates={friendlyCalendarDates}
                selectedDate={selectedFriendlyDate}
                onSelectDate={setSelectedFriendlyDate}
                matches={friendlyMatches}
                onMatchClick={(match) => navigateTo("partido", { id: match.id })}
                emptyMessage="No hay amistosos disponibles."
              />
            ) : (
              <EmptyState>No hay amistosos disponibles.</EmptyState>
            )
          ) : null}

          <div className="mt-4">
            <AdBannerMedium2 />
          </div>
        </section>
      </div>

      <Footer />

    </div>
  );
}

