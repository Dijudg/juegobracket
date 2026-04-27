import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import LogotipoFanaticos from "../imports/LogotipoFanaticos";
import menuSvgPaths from "../imports/svg-c4rl9o1tin";
import { useNavigation } from "../contexts/NavigationContext";

type NavItem =
  | { label: string; href: string; external?: boolean }
  | { label: string; page: string }
  | { label: "Volver al Telégrafo"; telegrafoMenu: true }
  | { label: "Polla Mundialista"; submenu: true };

type HeaderProps = {
  authSlot?: React.ReactNode;
  showNav?: boolean;
  showSearch?: boolean;
  onNewGameClick?: () => void;
  onRegisterClick?: () => void;
};

const FANATICO_URL = "https://especiales.eltelegrafo.com.ec/fanaticomundialista/";
const TELEGRAFO_URL = "https://www.eltelegrafo.com.ec";

const TELEGRAFO_MENU_LINKS = [
  { href: `${TELEGRAFO_URL}/`, label: "El Telégrafo" },
  { href: `${TELEGRAFO_URL}/ultima-hora`, label: "Última hora" },
  { href: `${TELEGRAFO_URL}/nacionales`, label: "Nacionales" },
  { href: `${TELEGRAFO_URL}/internacionales`, label: "Internacionales" },
  { href: `${TELEGRAFO_URL}/deportes`, label: "Deporte" },
  { href: `${TELEGRAFO_URL}/tendencias`, label: "Tendencias" },
  { href: `${TELEGRAFO_URL}/opinion`, label: "Opinión" },
  { href: `${TELEGRAFO_URL}/especiales-et`, label: "Especiales" },
  { href: `${TELEGRAFO_URL}/avisos`, label: "Clasificados" },
  { href: `${TELEGRAFO_URL}/empresariales`, label: "Empresariales" },
  { href: `${TELEGRAFO_URL}/recetas`, label: "Recetas" },
];

const NAV_LINKS: NavItem[] = [
  { label: "Volver al Telégrafo", telegrafoMenu: true },
  { href: FANATICO_URL, label: "Portada" },
  { href: `${FANATICO_URL}envivo`, label: "En Vivo" },
  { href: `${FANATICO_URL}calendario`, label: "Calendario" },
  { href: `${FANATICO_URL}ecuador`, label: "Ecuador" },
  { href: `${FANATICO_URL}grupos`, label: "Grupos" },
  { href: `${FANATICO_URL}noticias`, label: "Noticias" },
  { label: "Polla Mundialista", submenu: true },
  { href: `${FANATICO_URL}resultados`, label: "Resultados" },
  { href: `${FANATICO_URL}estadios`, label: "Estadios" },
  { href: `${FANATICO_URL}selecciones`, label: "Selecciones" },
];

const MOBILE_NAV_LINKS: NavItem[] = [
  { href: FANATICO_URL, label: "Portada" },
  { href: `${FANATICO_URL}envivo`, label: "En Vivo" },
  { href: `${FANATICO_URL}calendario`, label: "Calendario" },
  { href: `${FANATICO_URL}ecuador`, label: "Ecuador" },
  { href: `${FANATICO_URL}grupos`, label: "Grupos" },
  { href: `${FANATICO_URL}noticias`, label: "Noticias" },
  { label: "Polla Mundialista", submenu: true },
  { href: `${FANATICO_URL}resultados`, label: "Resultados" },
  { href: `${FANATICO_URL}estadios`, label: "Estadios" },
  { href: `${FANATICO_URL}selecciones`, label: "Selecciones" },
  { label: "Volver al Telégrafo", telegrafoMenu: true },
];

function BackIcon() {
  return (
    <svg
      className="size-4 md:size-[18px]"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11.5 5L6.5 10L11.5 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type GoogleAdSenseProps = {
  client?: string;
  slot?: string;
  format?: string;
  fullWidthResponsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

function GoogleAdSense({
  client,
  slot,
  format,
  fullWidthResponsive,
  className,
  style,
}: GoogleAdSenseProps) {
  useEffect(() => {
    if (!client || !slot) return;

    const scriptId = "adsbygoogle-js";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        client,
      )}`;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }

    try {
      const ads = ((window as any).adsbygoogle = (window as any).adsbygoogle || []);
      ads.push({});
    } catch {
      // Ignore if adsbygoogle is not ready yet.
    }
  }, [client, slot]);

  if (!client || !slot) return null;

  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`.trim()}
      style={style}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={fullWidthResponsive ? "true" : undefined}
    />
  );
}

function AdBanner() {
  const [isMobile, setIsMobile] = useState(false);
  const [preferAdsense, setPreferAdsense] = useState(false);
  const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT;
  const adsenseSlot = import.meta.env.VITE_ADSENSE_SLOT_HEADER;
  const canUseAdsense = Boolean(adsenseClient && adsenseSlot);
  const useAdsense = preferAdsense && canUseAdsense;

  useEffect(() => {
    if (useAdsense) return;

    const scriptId = "eltelegrafo-adserver";
    const scriptSrc = "//adserver.eltelegrafo.com.ec/www/delivery/asyncjs.php";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) return;

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = scriptSrc;
    script.onerror = () => setPreferAdsense(true);
    document.body.appendChild(script);

    return () => {
      if (script.id !== scriptId) return;
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [useAdsense]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fallbackImage = isMobile
    ? "https://www.eltelegrafo.com.ec/images/Mundial2026/back/Pub-header.png"
    : "https://www.eltelegrafo.com.ec/images/Mundial2026/back/Desktop-header-back.png";

  return (
    <div className="w-full bg-neutral-900 rounded-lg overflow-hidden">
      <a
        href="https://www.ecuadortv.ec/programas/noticias-7"
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        <div
          className="w-full aspect-[10/1] m-2 flex items-center justify-center bg-neutral-800 relative overflow-hidden bg-center"
          style={{
            backgroundImage: `url('${fallbackImage}')`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          {useAdsense ? (
            <GoogleAdSense
              client={adsenseClient as string}
              slot={adsenseSlot as string}
              format="auto"
              fullWidthResponsive
              className="block w-full h-full relative z-10"
              style={{
                display: "block",
                width: "100%",
                height: "100%",
              }}
            />
          ) : (
            <ins
              data-revive-zoneid="3"
              data-revive-id="60f0b66ffc0f4db66aaad1c14934c701"
              className="block w-full h-full relative z-10"
            />
          )}
        </div>
      </a>
    </div>
  );
}

function Brand() {
  return (
    <a
      href={FANATICO_URL}
      className="bg-black relative rounded-lg shrink-0 w-full hover:bg-neutral-900 transition-colors shadow-sm/50"
    >
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="box-border content-stretch flex items-start md:px-12 md:py-10 px-4 py-2 relative w-full">
          <LogotipoFanaticos />
        </div>
      </div>
    </a>
  );
}

interface NavLinkProps {
  page: string;
  children: React.ReactNode;
  isActive?: boolean;
  onNavigate?: () => void;
  className?: string;
}

function NavLink({
  page,
  children,
  isActive = false,
  onNavigate,
  className,
}: NavLinkProps) {
  const { navigateTo } = useNavigation();

  return (
    <button
      type="button"
      onClick={() => {
        navigateTo(page);
        onNavigate?.();
      }}
      className={
        className ||
        `box-border content-stretch flex items-center justify-center px-3 py-1 relative shrink-0 rounded transition-colors ${
          isActive ? "text-[#C6F600]" : "text-white hover:text-[#C6F600]"
        }`
      }
    >
      <p className="font-semibold leading-6 not-italic relative shrink-0 text-base text-nowrap whitespace-pre">
        {children}
      </p>
    </button>
  );
}

const useHeaderDropdown = (open: boolean, minWidth: number) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

  const updatePosition = () => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;
    const rect = button.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(minWidth, window.innerWidth - gutter * 2);
    const left = Math.min(
      Math.max(gutter, rect.left),
      Math.max(gutter, window.innerWidth - width - gutter),
    );
    const top = rect.bottom + 8;
    setPanelStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight: `calc(100vh - ${top + gutter}px)`,
      zIndex: 10000,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }
    updatePosition();
  }, [open, minWidth]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return { buttonRef, panelRef, panelStyle, updatePosition };
};

const useCloseHeaderDropdown = (
  open: boolean,
  setOpen: (value: boolean) => void,
  buttonRef: React.RefObject<HTMLElement>,
  panelRef: React.RefObject<HTMLElement>,
) => {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [buttonRef, open, panelRef, setOpen]);
};

function PollaSubmenu({
  mobile = false,
  onNewGameClick,
  onRegisterClick,
  onNavigate,
  isActive = false,
}: {
  mobile?: boolean;
  onNewGameClick?: () => void;
  onRegisterClick?: () => void;
  onNavigate?: () => void;
  isActive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { navigateTo } = useNavigation();
  const { buttonRef, panelRef, panelStyle, updatePosition } = useHeaderDropdown(open, mobile ? 232 : 220);
  useCloseHeaderDropdown(open, setOpen, buttonRef, panelRef);

  const runAction = (action: () => void) => {
    action();
    setOpen(false);
    onNavigate?.();
  };

  const itemClass = mobile
    ? "block w-full px-4 py-2 text-left text-sm font-semibold text-white hover:bg-neutral-800 hover:text-[#C6F600]"
    : "block w-full px-4 py-2 text-left text-sm font-semibold text-white hover:bg-neutral-800 hover:text-[#C6F600]";

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updatePosition();
          setOpen((current) => !current);
        }}
        className={`box-border content-stretch flex items-center justify-center gap-2 px-3 py-1 relative shrink-0 rounded transition-colors ${
          open || isActive ? "text-[#C6F600]" : "text-white hover:text-[#C6F600]"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <p className="font-semibold leading-6 not-italic relative shrink-0 text-base text-nowrap whitespace-pre">
          Polla Mundialista
        </p>
        <ChevronDownIcon open={open} />
      </button>

      {open && panelStyle && (
        <div
          ref={panelRef}
          style={panelStyle}
          className="header-dropdown-menu overflow-y-auto rounded-md border border-neutral-800 bg-black shadow-2xl"
          role="menu"
        >
          <button
            type="button"
            className={itemClass}
            role="menuitem"
            onClick={() => runAction(onNewGameClick || (() => navigateTo("home")))}
          >
            Jugar nuevo juego
          </button>
          <button
            type="button"
            className={itemClass}
            role="menuitem"
            onClick={() => runAction(onRegisterClick || (() => navigateTo("home")))}
          >
            Registrarse
          </button>
          <button
            type="button"
            className={itemClass}
            role="menuitem"
            onClick={() => runAction(() => navigateTo("leaderboard"))}
          >
            Score
          </button>
        </div>
      )}
    </div>
  );
}

function TelegrafoSubmenu({ mobile = false }: { mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const { buttonRef, panelRef, panelStyle, updatePosition } = useHeaderDropdown(open, mobile ? 256 : 252);
  useCloseHeaderDropdown(open, setOpen, buttonRef, panelRef);
  const itemClass =
    "block w-full px-4 py-2 text-left text-sm font-semibold text-white hover:bg-neutral-800 hover:text-[#C6F600]";

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updatePosition();
          setOpen((current) => !current);
        }}
        className={`box-border content-stretch flex items-center justify-center gap-2 px-3 py-1 relative shrink-0 rounded transition-colors ${
          open ? "text-[#C6F600]" : "text-white hover:text-[#C6F600]"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <BackIcon />
          <p className="font-semibold leading-6 not-italic relative shrink-0 text-base text-nowrap whitespace-pre">
            Volver al Telégrafo
          </p>
          <ChevronDownIcon open={open} />
        </span>
      </button>

      {open && panelStyle && (
        <div
          ref={panelRef}
          style={panelStyle}
          className="header-dropdown-menu overflow-y-auto rounded-md border border-neutral-800 bg-black shadow-2xl"
          role="menu"
        >
          {TELEGRAFO_MENU_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={itemClass}
              role="menuitem"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Nav({
  scrollRef,
  onNewGameClick,
  onRegisterClick,
}: {
  scrollRef?: React.RefObject<HTMLDivElement>;
  onNewGameClick?: () => void;
  onRegisterClick?: () => void;
}) {
  const { currentPage } = useNavigation();
  const isPollaActive = currentPage === "home" || currentPage === "leaderboard" || currentPage === "backend";

  return (
    <div className="basis-0 bg-black shadow-md/60 grow h-8 min-h-px min-w-px relative rounded-md shrink-0 z-[200]">
      <div
        ref={scrollRef}
        className="overflow-visible size-full"
      >
        <div className="box-border content-stretch flex h-8 items-center px-2 py-2 relative w-full">
          <div className="content-stretch flex items-center relative shrink-0">
            {NAV_LINKS.map((link) => (
              <div key={link.label} className="relative shrink-0">
                {"submenu" in link ? (
                  <PollaSubmenu
                    isActive={isPollaActive}
                    onNewGameClick={onNewGameClick}
                    onRegisterClick={onRegisterClick}
                  />
                ) : "telegrafoMenu" in link ? (
                  <TelegrafoSubmenu />
                ) : "href" in link ? (
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noreferrer" : undefined}
                    className="box-border content-stretch flex items-center justify-center px-3 py-1 relative shrink-0 rounded transition-colors text-white hover:text-[#C6F600]"
                  >
                    <span className="flex items-center gap-2">
                      {link.label === "Volver al Telégrafo" ? <BackIcon /> : null}
                      <p className="font-semibold leading-6 not-italic relative shrink-0 text-base text-nowrap whitespace-pre">
                        {link.label}
                      </p>
                    </span>
                  </a>
                ) : (
                  <NavLink page={link.page} isActive={currentPage === link.page}>
                    {link.label}
                  </NavLink>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlMenuButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 shrink-0 w-5 hover:opacity-80 transition-opacity"
      aria-label="Avanzar"
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 15 30"
      >
        <path
          d="M4 8L11 15L4 22"
          stroke="#C6F600"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.75"
        />
      </svg>
    </button>
  );
}

function SearchIcon() {
  return (
    <div className="relative shrink-0 w-full px-2">
      <svg
        className="block size-5"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 18 19"
      >
        <g>
          <path d={menuSvgPaths.p242a9a00} fill="#EFF0F4" />
          <path d={menuSvgPaths.p13e5dd00} fill="#EFF0F4" />
        </g>
      </svg>
    </div>
  );
}

function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-black max-w-1/6 flex flex-col h-8 items-right justify-right overflow-clip p-1.5 relative rounded-md shrink-0 hover:bg-neutral-900 transition-colors"
      aria-label="Buscar"
    >
      <div className="content-stretch flex flex-col items-start justify-center overflow-clip relative shrink-0">
        <SearchIcon />
      </div>
    </button>
  );
}

function MobileNav({
  onNewGameClick,
  onRegisterClick,
}: {
  onNewGameClick?: () => void;
  onRegisterClick?: () => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { currentPage } = useNavigation();
  const isPollaActive = currentPage === "home" || currentPage === "leaderboard" || currentPage === "backend";

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      const currentScroll = scrollContainerRef.current.scrollLeft;
      scrollContainerRef.current.scrollTo({
        left: currentScroll + 200,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="content-stretch flex gap-1 items-center relative w-5/6 z-[200]">
      <div className="basis-0 bg-black shadow-md/60 grow min-h-px min-w-px relative rounded-md shrink-0">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <div className="box-border content-stretch flex min-h-8 items-center px-2 py-1 relative w-full">
            <div className="content-stretch flex items-start relative shrink-0">
              {MOBILE_NAV_LINKS.map((link) => (
                <div key={link.label} className="relative shrink-0">
                  {"submenu" in link ? (
                    <PollaSubmenu
                      mobile
                      isActive={isPollaActive}
                      onNewGameClick={onNewGameClick}
                      onRegisterClick={onRegisterClick}
                    />
                  ) : "telegrafoMenu" in link ? (
                    <TelegrafoSubmenu mobile />
                  ) : "href" in link ? (
                    <a
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noreferrer" : undefined}
                      className="box-border content-stretch flex items-center justify-center px-3 py-1 relative shrink-0 rounded transition-colors text-white hover:text-[#C6F600]"
                    >
                      <span className="flex items-center gap-2">
                        {link.label === "Volver al Telégrafo" ? <BackIcon /> : null}
                        <p className="font-semibold leading-6 not-italic relative shrink-0 text-base text-nowrap whitespace-pre">
                          {link.label}
                        </p>
                      </span>
                    </a>
                  ) : (
                    <NavLink page={link.page} isActive={currentPage === link.page}>
                      {link.label}
                    </NavLink>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <ControlMenuButton onClick={handleScrollRight} />
    </div>
  );
}

export default function Header({
  authSlot,
  showNav = true,
  showSearch = true,
  onNewGameClick,
  onRegisterClick,
}: HeaderProps) {
  const { navigateTo } = useNavigation();

  return (
    <header className="content-stretch flex flex-col gap-2 items-start w-full relative z-[200]">
      <AdBanner />
      <Brand />

      {(showNav || showSearch || authSlot) && (
        <div className="hidden lg:flex content-stretch gap-3 items-center relative w-full">
          {showNav && (
            <Nav onNewGameClick={onNewGameClick} onRegisterClick={onRegisterClick} />
          )}
          {showSearch && <SearchButton onClick={() => navigateTo("busqueda")} />}
          {authSlot}
        </div>
      )}

      {(showNav || showSearch || authSlot) && (
        <div className="flex lg:hidden gap-2 w-full">
          {showNav && (
            <MobileNav onNewGameClick={onNewGameClick} onRegisterClick={onRegisterClick} />
          )}
          {showSearch && <SearchButton onClick={() => navigateTo("busqueda")} />}
          {authSlot}
        </div>
      )}
    </header>
  );
}
