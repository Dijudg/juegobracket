import { useState, useEffect, useRef } from "react";
import LogotipoFanaticos from "../imports/LogotipoFanaticos";
import menuSvgPaths from "../imports/svg-c4rl9o1tin";
import { useNavigation } from "../contexts/NavigationContext";

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

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://publi.eltelegrafo.com.ec/delivery/asyncjs.php";
    script.onerror = () => setPreferAdsense(true);
    document.body.appendChild(script);

    return () => {
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
    </div>
  );
}
function Brand() {
  return (
    <a
      href="https://especiales.eltelegrafo.com.ec/fanaticomundialista/"
      className="bg-black relative rounded-lg shrink-0 w-full hover:bg-neutral-900 transition-colors shadow-sm/50

"
    >
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="box-border content-stretch flex items-start md:px-12 md:py-10 px-4 py-2 relative w-full ">
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
}

function NavLink({
  page,
  children,
  isActive = false,
}: NavLinkProps) {
  const { navigateTo } = useNavigation();
  
  return (
    <button
      onClick={() => navigateTo(page)}
      className={`box-border content-stretch flex items-center justify-center px-3 py-1 relative shrink-0 rounded transition-colors ${ isActive
          ? "text-[#C6F600]"
          : "text-white hover:text-[#C6F600]"
      }`}
    >
      <p className="font-semibold leading-6 not-italic relative shrink-0 text-base text-nowrap whitespace-pre">
        {children}
      </p>
    </button>
  );
}

function Nav({
  isMobile = false,
  scrollRef,
}: {
  isMobile?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement>;
}) {
  const { currentPage } = useNavigation();

  type NavItem = { label: string; page: string } | { label: string; href: string };

  const links: NavItem[] = [
    { href: "https://www.eltelegrafo.com.ec", label: "Volver al Telégrafo" },
    { page: "home", label: "Portada" },
   /* { page: "envivo", label: "En Vivo" }, */
    { page: "calendario", label: "Calendario" },
    { page: "ecuador", label: "Ecuador" },
    { page: "grupos", label: "Grupos" },
    { page: "noticias", label: "Noticias" },
    { page: "polla", label: "Tu Mundial" },
   /* { page: "resultados", label: "Resultados" }, */
    { page: "selecciones", label: "Selecciones" },
  ];

  return (
    <div className="basis-0 bg-black  shadow-md/60 grow h-8 min-h-px min-w-px relative rounded-md shrink-0">
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-clip size-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <div className="box-border content-stretch flex  h-8 items-center px-2 py-2 relative w-full">
          <div className="content-stretch flex items-center relative shrink-0">
            {links.map((link) => (
              <div
                key={link.label}
              >
                {"href" in link ? (
                  <a
                    href={link.href}
                    className="box-border content-stretch flex items-center justify-center px-3 py-1 relative shrink-0 rounded transition-colors text-white hover:text-[#C6F600]"
                  >
                    <span className="flex items-center gap-2">
                      <BackIcon />
                      <p className="font-semibold leading-6 not-italic relative shrink-0 text-base text-nowrap whitespace-pre">
                        {link.label}
                      </p>
                    </span>
                  </a>
                ) : (
                  <NavLink
                    page={link.page}
                    isActive={currentPage === link.page}
                  >
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
        <g>
          <path
            d="M4 8L11 15L4 22"
            stroke="#C6F600"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.75"
          />
        </g>
      </svg>
    </button>
  );
}

function SearchIcon() {
  return (
    <div className=" relative shrink-0 w-full px-2">
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
      className="bg-black max-w-1/6 flex flex-col h-8 items-right justify-right overflow-clip p-1.5 relative rounded-md shrink-0  hover:bg-neutral-900 transition-colors"
      aria-label="Buscar"
    >
      <div className="content-stretch flex flex-col  items-start justify-center overflow-clip relative shrink-0 ">
        <SearchIcon />
      </div>
    </button>
  );
}

function MobileNav() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      const currentScroll =
        scrollContainerRef.current.scrollLeft;

      scrollContainerRef.current.scrollTo({
        left: currentScroll + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="content-stretch flex gap-1 items-center relative w-5/6">
      <Nav isMobile scrollRef={scrollContainerRef} />
      <ControlMenuButton onClick={handleScrollRight} />
    </div>
  );
}

export default function Header({
  authSlot,
  showNav = true,
  showSearch = true,
}: {
  authSlot?: React.ReactNode;
  showNav?: boolean;
  showSearch?: boolean;
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const { navigateTo } = useNavigation();

  useEffect(() => {
    const handleScroll = () => {
      // Make header sticky when scrolled past 150px
      setIsScrolled(window.scrollY > 150);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="content-stretch flex flex-col gap-2 items-start w-full relative">
      {/* Ad Banner */}
      <AdBanner />
      
      <Brand />

      {/* Desktop Navigation */}
      {(showNav || showSearch) && (
        <div className="hidden lg:flex content-stretch gap-3 items-center relative w-full">
          {showNav && <Nav />}
          {showSearch && (
            <SearchButton
              onClick={() => navigateTo('busqueda')}
            />
          )}
        </div>
      )}

      {/* Mobile Navigation with horizontal scroll */}
      {(showNav || showSearch) && (
        <div className="flex lg:hidden gap-2 w-full">
          {showNav && <MobileNav />}
          {showSearch && (
            <SearchButton
              onClick={() => navigateTo('busqueda')}
            />
          )}
        </div>
      )}
    </header>
  );
}






