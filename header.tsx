import { useState, useEffect, useRef } from "react";
import LogotipoFanaticos from "../imports/LogotipoFanaticos";
import Isotipo from "../imports/Isotipo";
import menuSvgPaths from "../imports/svg-c4rl9o1tin";
import { useNavigation } from "../contexts/NavigationContext";
import { POLLA_MUNDIALISTA_URL } from "../constants/links";

type NavItem = { label: string; page: string } | { label: string; href: string };

const NAV_LINKS: NavItem[] = [
  { href: "https://www.eltelegrafo.com.ec", label: "Volver al Telegrafo" },
  { page: "home", label: "Portada" },
  { page: "envivo", label: "En Vivo" },
  { page: "calendario", label: "Calendario" },
  { page: "ecuador", label: "Ecuador" },
  { page: "grupos", label: "Grupos" },
  { page: "noticias", label: "Noticias" },
  { href: POLLA_MUNDIALISTA_URL, label: "Polla Mundialista" },
  { page: "resultados", label: "Resultados" },
  { page: "estadios", label: "Estadios" },
  { page: "selecciones", label: "Selecciones" },
];

const MOBILE_NAV_LINKS: NavItem[] = [
  { page: "home", label: "Portada" },
  { page: "envivo", label: "En Vivo" },
  { page: "calendario", label: "Calendario" },
  { page: "ecuador", label: "Ecuador" },
  { page: "grupos", label: "Grupos" },
  { page: "noticias", label: "Noticias" },
  { page: "resultados", label: "Resultados" },
  { page: "estadios", label: "Estadios" },
  { page: "selecciones", label: "Selecciones" },
  { href: POLLA_MUNDIALISTA_URL, label: "Polla Mundialista" },
  { href: "https://www.eltelegrafo.com.ec", label: "Volver al Telegrafo" },
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

function AdBanner() {
  const [isMobile, setIsMobile] = useState(false);
  const [showFallbackLink, setShowFallbackLink] = useState(false);
  const adContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAdLoaded = () => {
      const insElement = adContainerRef.current?.querySelector("ins");
      const hasRenderedAd = Boolean(
        insElement?.querySelector("iframe,img,a,div") ||
          insElement?.textContent?.trim() ||
          (insElement?.children.length ?? 0) > 0,
      );
      setShowFallbackLink(!hasRenderedAd);
    };

    const fallbackTimer = window.setTimeout(checkAdLoaded, 10000);

    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, []);

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
      <div
        ref={adContainerRef}
        className="relative m-2 flex w-full items-center justify-center overflow-hidden bg-neutral-800 bg-center aspect-[10/1] lg:mx-auto lg:my-1.5 lg:w-2/3 lg:aspect-[12/0.42]"
        style={{
          backgroundImage: `url('${fallbackImage}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <ins
          data-revive-zoneid="1"
          data-revive-id="60f0b66ffc0f4db66aaad1c14934c701"
          className="block w-full h-full relative z-10"
        />
        {showFallbackLink && (
          <a
            href="https://www.ecuadortv.ec/programas/noticias-7"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 z-20"
            aria-label="Ir a Noticias 7"
          />
        )}
      </div>
    </div>
  );
}

function Brand() {
  return (
    <a
      href="https://especiales.eltelegrafo.com.ec/fanaticomundialista/"
      className="bg-black relative rounded-lg shrink-0 w-full hover:bg-neutral-900 transition-colors shadow-sm/50 lg:mx-auto lg:w-2/3"
    >
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="box-border content-stretch flex items-center justify-center px-4 py-2 md:px-8 md:py-3 lg:px-8 lg:py-2 relative w-full">
          <div className="h-[34px] w-full md:h-[38px] md:max-w-[360px] lg:h-[22px] lg:w-2/3 lg:max-w-none">
            <LogotipoFanaticos />
          </div>
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
      onClick={() => {
        navigateTo(page);
        onNavigate?.();
      }}
      className={
        className ||
        `site-header-nav-link ${isActive ? "is-active" : ""}`
      }
    >
      <p className="font-semibold leading-6 not-italic relative shrink-0 text-base text-nowrap whitespace-pre">
        {children}
      </p>
    </button>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { currentPage } = useNavigation();

  return (
    <div className="site-header-nav-shell">
      <div className="site-header-nav-track">
        <div className="site-header-nav-row">
          <div className="site-header-nav-items">
            {NAV_LINKS.map((link) => (
              <div key={link.label}>
                {"href" in link ? (
                  <a
                    href={link.href}
                    onClick={onNavigate}
                    className="site-header-nav-link"
                  >
                    <span className="flex items-center gap-2">
                      {link.label === "Volver al Telegrafo" ? <BackIcon /> : null}
                      <p className="font-semibold leading-6 not-italic relative shrink-0 text-base text-nowrap whitespace-pre">
                        {link.label}
                      </p>
                    </span>
                  </a>
                ) : (
                  <NavLink page={link.page} isActive={currentPage === link.page} onNavigate={onNavigate}>
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
      onClick={onClick}
      className="site-header-icon-button"
      aria-label="Buscar"
    >
      <div className="content-stretch flex flex-col items-start justify-center overflow-clip relative shrink-0">
        <SearchIcon />
      </div>
    </button>
  );
}

function HamburgerButton({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="site-header-icon-button"
      aria-label={isOpen ? "Cerrar menu" : "Abrir menu"}
      aria-expanded={isOpen}
    >
      <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={isOpen ? "M6 6L18 18M18 6L6 18" : "M4 7H20M4 12H20M4 17H20"}
          stroke="#C6F600"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      </svg>
    </button>
  );
}

function MobileMenu({
  isOpen,
  backdropTop = 0,
  onClose,
}: {
  isOpen: boolean;
  backdropTop?: number;
  onClose: () => void;
}) {
  const { currentPage } = useNavigation();

  if (!isOpen) return null;

  const getMobileItemClassName = (label: string, isActive = false) => {
    const specialClass =
      label === "Polla Mundialista"
        ? "mobile-hamburger-menu__item--polla"
        : label === "Volver al Telegrafo"
          ? "mobile-hamburger-menu__item--telegrafo"
          : "";

    return `mobile-hamburger-menu__item ${specialClass} ${
      isActive ? "is-active" : ""
    }`.trim();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar menu"
        className="mobile-hamburger-menu__backdrop lg:hidden"
        style={{ top: `${backdropTop}px` }}
        onClick={onClose}
      />
      <div className="mobile-hamburger-menu__panel lg:hidden">
        <div className="mobile-hamburger-menu__list">
          {MOBILE_NAV_LINKS.map((link) =>
            "href" in link ? (
              <a
                key={link.label}
                href={link.href}
                onClick={onClose}
                className={`${getMobileItemClassName(link.label)} mobile-hamburger-menu__item--external`}
              >
                {link.label === "Volver al Telegrafo" ? <BackIcon /> : null}
                <span>{link.label}</span>
              </a>
            ) : (
              <NavLink
                key={link.label}
                page={link.page}
                isActive={currentPage === link.page}
                onNavigate={onClose}
                className={getMobileItemClassName(
                  link.label,
                  currentPage === link.page,
                )}
              >
                {link.label}
              </NavLink>
            ),
          )}
        </div>
      </div>
    </>
  );
}

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { navigateTo, currentPage } = useNavigation();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentPage]);

  return (
    <header ref={headerRef} className="content-stretch flex flex-col gap-2 items-start w-full relative">
      <AdBanner />
      <Brand />

      <div className="hidden lg:flex content-stretch gap-3 items-center relative w-full">
        <Nav />
        <SearchButton onClick={() => navigateTo("busqueda")} />
      </div>

      <div className="site-header-mobile-row relative flex lg:hidden">
        

        <div className="w-4/6">
          <div className="site-header-mobile-title">
            <span className="site-header-mobile-title__text">
              {NAV_LINKS.find((link) => "page" in link && link.page === currentPage)?.label || "Menu"}
            </span>
          </div>
        </div>

        <div className="w-2/6 flex justify-end gap-2">
          <SearchButton onClick={() => navigateTo("busqueda")} />
          <div className="relative flex shrink-0">
            <HamburgerButton
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((current) => !current)}
            />
            <MobileMenu
              isOpen={isMobileMenuOpen}
              backdropTop={headerRef.current?.getBoundingClientRect().bottom ?? 0}
              onClose={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
