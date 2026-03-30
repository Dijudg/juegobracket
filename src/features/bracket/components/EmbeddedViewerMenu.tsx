type ViewerTab = "repechajes" | "grupos" | "dieciseisavos" | "llaves";
type ViewerPlayoffTab = "uefa" | "intercontinental";

export const EmbeddedViewerMenu = ({
  tab,
  playoffTab,
  onNavigate,
  showRepechajes = true,
  showRepechajeSubnav = true,
}: {
  tab: ViewerTab;
  playoffTab: ViewerPlayoffTab;
  onNavigate: (tab: ViewerTab, playoffTab?: ViewerPlayoffTab, scrollId?: string) => void;
  showRepechajes?: boolean;
  showRepechajeSubnav?: boolean;
}) => {
  return (
    <>
      <div className="viewer-mobile-menu m-2 rounded-full fixed left-0 right-0 bottom-0 z-50 md:static md:z-auto">
        <div className="viewer-mobile-menu__main md:mb-3">
          <div className="viewer-mobile-menu__scroller viewer-mobile-menu__scroller--hint scrollbar-hide">
            <div className="viewer-mobile-menu__track">
              {showRepechajes && (
                <button
                  type="button"
                  onClick={() => onNavigate("repechajes", playoffTab)}
                  className={`shrink-0 px-3 py-2 rounded-full  whitespace-nowrap text-base font-semibold transition ${
                    tab === "repechajes"
                      ? "bg-[#c6f600] text-black  "
                      : " text-gray-400 hover:text-white"
                  }`}
                >
                  Liguilla de Repechajes
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate("grupos")}
                className={`shrink-0 px-3 py-2 rounded-full  whitespace-nowrap text-base font-semibold transition ${
                  tab === "grupos"
                    ? "bg-[#c6f600] text-black text-base "
                    : "text-gray-400"
                }`}
              >
                Fase de grupos
              </button>
              <button
                type="button"
                onClick={() => onNavigate("dieciseisavos")}
                className={`shrink-0 px-3 py-2 rounded-full whitespace-nowrap text-base font-semibold transition ${
                  tab === "dieciseisavos"
                    ? "bg-[#c6f600] text-black "
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Eliminatorias
              </button>
              <button
                type="button"
                onClick={() => onNavigate("llaves")}
                className={`shrink-0 px-3 py-2 rounded-full whitespace-nowrap text-base font-semibold transition ${
                  tab === "llaves"
                    ? "bg-[#c6f600] text-black "
                    : "border-neutral-700 text-gray-400 hover:text-white"
                }`}
              >
                Llaves finales
              </button>
            </div>
          </div>
          <div className="viewer-mobile-menu__right-hint" aria-hidden="true">
            <span className="viewer-mobile-menu__right-hint-arrow">{">"}</span>
          </div>
        </div>
      </div>

      {showRepechajes && showRepechajeSubnav && tab === "repechajes" && (
        <div className="w-full mb-3">
          <div className="flex w-full items-center">
            <button
              type="button"
              onClick={() => onNavigate("repechajes", "uefa")}
              className={`w-1/2 px-3 py-2 rounded-full text-center whitespace-nowrap text-base font-semibold transition ${
                playoffTab === "uefa"
                  ? "bg-[#c6f600] text-black  "
                  : " text-gray-400 hover:text-white"
              }`}
            >
              Liguilla UEFA
            </button>
            <button
              type="button"
              onClick={() => onNavigate("repechajes", "intercontinental")}
              className={`w-1/2 px-3 py-2 rounded-full text-center whitespace-nowrap text-base font-semibold transition ${
                playoffTab === "intercontinental"
                  ? "bg-[#c6f600] text-black "
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Liguilla Intercontinental
            </button>
          </div>
        </div>
      )}
    </>
  );
};
