import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import LogotipoFanaticos from "../imports/LogotipoFanaticos";
import facebookIcon from "../assets/facebook.svg";
import instagramIcon from "../assets/instagram.svg";
import tiktokIcon from "../assets/tiktok.svg";
import youtubeIcon from "../assets/youtube.svg";
import xIcon from "../assets/x.svg";
import etLogo from "../assets/ET_LOGO.png";
import ectvLogo from "../assets/ECTV_LOGO.png";
import { supabase } from "../utils/supabaseClient";
import { resolveApiBase } from "../utils/apiBase";
import { useNavigation } from "../contexts/NavigationContext";

function BackIcon() {
  return (
    <svg className="size-4 md:size-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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

function BotonFooter({ text, page = "home" }: { text: string; page?: string }) {
  const { navigateTo, currentPage } = useNavigation();
  const isActive = currentPage === page;

  return (
    <button
      onClick={() => navigateTo(page)}
      className={`box-border content-stretch flex gap-1 items-center justify-center px-1 md:px-4 py-2 relative shrink-0 transition-colors ${
        isActive ? "text-[#C6F600]" : "text-white hover:text-[#C6F600]"
      }`}
      data-name="Boton Footer"
    >
      <div
        className={`flex flex-col justify-center not-italic relative shrink-0 text-base text-center ${
          isActive ? "text-[#C6F600]" : "text-white"
        }`}
      >
        <p className="leading-1">{text}</p>
      </div>
    </button>
  );
}

function ExternalFooterLink({ text, href }: { text: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="box-border content-stretch flex gap-2 items-center justify-center px-1 md:px-4 py-2 relative shrink-0 transition-colors text-white hover:text-[#C6F600]"
      data-name="Boton Footer"
    >
      <BackIcon />
      <div className="flex flex-col justify-center not-italic relative shrink-0 text-base text-center text-current">
        <p className="leading-1">{text}</p>
      </div>
    </a>
  );
}

function ExternalMenuLink({ text, href }: { text: string; href: string }) {
  return (
    <a
      href={href}
      className="box-border content-stretch flex gap-1 items-center justify-center px-1 md:px-4 py-2 relative shrink-0 transition-colors text-white hover:text-[#C6F600]"
      data-name="Boton Footer"
    >
      <div className="flex flex-col justify-center not-italic relative shrink-0 text-base text-center text-current">
        <p className="leading-1">{text}</p>
      </div>
    </a>
  );
}

function Menu() {
  const fanaticoUrl = "https://especiales.eltelegrafo.com.ec/fanaticomundialista/";

  return (
    <div
      className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-0 md:h-12 items-center overflow-clip relative shrink-0"
      data-name="Menu"
    >
      
      <BotonFooter text="Juega" page="home" />
      <BotonFooter text="Ranking" page="leaderboard" />
      <ExternalMenuLink text="Noticias del Mundial" href={fanaticoUrl} />
      <ExternalMenuLink text="Calendario" href={fanaticoUrl} />
      <ExternalMenuLink text="Ecuador" href={fanaticoUrl} />
      <ExternalMenuLink text="Grupos" href={fanaticoUrl} />
      <ExternalMenuLink text="Resultados" href={fanaticoUrl} />
      <ExternalMenuLink text="Selecciones" href={fanaticoUrl} />
      <ExternalFooterLink text="Volver al Telégrafo" href="https://www.eltelegrafo.com.ec" />
    </div>
  );
}

function useFooterAuthUser() {
  const [authUser, setAuthUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setAuthUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setAuthUser(null);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setAuthUser(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return authUser;
}

function AuthSlot({ className = "" }: { className?: string }) {
  const { navigateTo } = useNavigation();
  const authUser = useFooterAuthUser();
  const [signOutBusy, setSignOutBusy] = useState(false);

  const authMeta = (authUser?.user_metadata || {}) as Record<string, any>;
  const profileName = useMemo(
    () => authMeta.alias || authMeta.nickname || authMeta.full_name || authMeta.name || authUser?.email || "Usuario",
    [authMeta.alias, authMeta.full_name, authMeta.name, authMeta.nickname, authUser?.email],
  );
  const profileAvatar = useMemo(() => authMeta.avatar_url || authMeta.picture || authMeta.avatar || "", [
    authMeta.avatar,
    authMeta.avatar_url,
    authMeta.picture,
  ]);
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || "U";

  const handleSignOut = async () => {
    setSignOutBusy(true);
    try {
      await supabase.auth.signOut();
      navigateTo("home");
    } finally {
      setSignOutBusy(false);
    }
  };

  return (
    <div
      className={`w-full h-full rounded-xl px-3 py-2 flex items-center ${className}`.trim()}
      data-name="Auth Slot"
    >
      {authUser ? (
        <div className="w-full flex items-center justify-center px-2 gap-2">
          <button
            type="button"
            onClick={() => navigateTo("backend")}
            className="min-w-0 flex items-center gap-2 text-left text-white hover:text-[#c6f600] transition-colors"
          >
            {profileAvatar ? (
              <img src={profileAvatar} alt={profileName} className="size-8 rounded-full object-cover border border-neutral-700" />
            ) : (
              <span className="size-8 rounded-full bg-[#c6f600] text-black text-xs font-black inline-flex items-center justify-center">
                {profileInitial}
              </span>
            )}
            <span className="truncate text-sm">Perfil: {profileName}</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signOutBusy}
            className="text-xs whitespace-nowrap text-gray-300 hover:text-[#c6f600] transition-colors disabled:opacity-60"
          >
            {signOutBusy ? "Cerrando..." : "Cerrar sesion"}
          </button>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-2">
         
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo("backend")}
              className="flex-1 px-3 py-2 rounded-full border border-neutral-700 text-xs text-white hover:text-[#c6f600] hover:border-[#c6f600] transition-colors"
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              onClick={() => navigateTo("backend")}
              className="flex-1 px-3 py-2 rounded-full bg-[#c6f600] text-black text-xs font-semibold hover:brightness-95 transition"
            >
              Crear cuenta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeSlot({ className = "" }: { className?: string }) {
  const [codeInput, setCodeInput] = useState("");
  const [lookupStatus, setLookupStatus] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  const handleLookupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      setLookupStatus("Ingresa tu codigo.");
      return;
    }
    setLookupBusy(true);
    setLookupStatus(null);
    try {
      const baseUrl = resolveApiBase();
      if (!baseUrl) throw new Error("No se pudo conectar con el servidor.");
      const res = await fetch(`${baseUrl}/api/brackets/code/${encodeURIComponent(code)}`);
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        if (res.status === 404) throw new Error("No encontramos ese codigo.");
        throw new Error(message || "No pudimos revisar el bracket.");
      }
      const data = (await res.json()) as { id?: string; sharePageUrl?: string };
      const targetUrl = data.sharePageUrl || (data.id ? new URL(`/share/${data.id}`, baseUrl).toString() : "");
      if (!targetUrl) throw new Error("No se pudo generar el enlace.");
      if (typeof window !== "undefined") window.location.href = targetUrl;
    } catch (err) {
      setLookupStatus(err instanceof Error ? err.message : "No pudimos revisar el bracket.");
    } finally {
      setLookupBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleLookupSubmit}
      className={`w-full h-full flex flex-col items-center gap-2 px-4 ${className}`.trim()}
      data-name="Codigo Slot"
    >
      
      <div className="flex items-center gap-2 px-4 w-full">
        <input
          type="text"
          value={codeInput}
          onChange={(event) => {
            setCodeInput(event.target.value);
            if (lookupStatus) setLookupStatus(null);
          }}
          placeholder="Código del juego"
          className="w-full rounded-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          disabled={lookupBusy}
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            lookupBusy ? "bg-neutral-700 text-gray-300" : "bg-[#c6f600] text-black hover:brightness-95"
          }`}
        >
          {lookupBusy ? "Buscando..." : "Ver"}
        </button>
      </div>
      {lookupStatus && <span className="text-[11px] text-gray-400">{lookupStatus}</span>}
    </form>
  );
}

function FooterLine() {
  return (
    <div
      className="bg-[#1d1d1b] content-center flex flex-col gap-4 pb-4 items-center pt-4  px-2 justify-center overflow-clip relative shrink-0 w-full"
      data-name="footer-Line1"
    >
      <div className="w-full max-w-[1200px] box-border grid grid-cols-1 md:grid-cols-3 gap-3 px-3 md:px-[60px] pt-[28px]">
        <div className="flex items-center justify-center md:justify-start min-h-[76px]">
          <div className="w-[220px] md:w-[312px] h-auto">
            <LogotipoFanaticos />
          </div>
        </div>
        <AuthSlot className="min-h-[76px]" />
        <CodeSlot className="min-h-[76px]" />
      </div>
      <Menu />
    </div>
  );
}

function Direccion() {
  return (
    <div className="box-border content-stretch flex items-center px-[16px] py-2 relative shrink-0" data-name="Direccion">
      <div className="flex flex-col justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-center text-white">
        <p className="leading-[25px]">
          San Salvador E6-49 y Eloy Alfaro
          <br />
          Contacto: +593 98 777 7778
          <br />
          info@comunica.ec
        </p>
      </div>
    </div>
  );
}

function Publicidad() {
  return (
    <div className="basis-0 content-stretch flex grow items-center justify-center min-h-px min-w-px relative shrink-0">
      <div className="flex flex-col justify-center sm:my-4 not-italic relative shrink-0 text-base text-center text-white">
        <a
          href="https://api.whatsapp.com/send/?phone=593987777778&text=Quiero+m%C3%A1s+informaci%C3%B3n&type=phone_number&app_absent=0"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-0 hover:text-[#C6F600] transition-colors cursor-pointer"
        >
          Contacto
        </a>
        <a
          href="https://quegusto.comunica.ec/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#C6F600] transition-colors cursor-pointer"
        >
          Publicidad
        </a>
      </div>
    </div>
  );
}

function Legal() {
  return (
    <div className="box-border content-stretch flex items-center justify-end px-[16px] py-2 relative shrink-0" data-name="Legal">
      <div className="flex flex-col justify-center leading-[25px] not-italic relative shrink-0 text-sm md:text-base text-center text-white">
        <a
          href="https://www.eltelegrafo.com.ec/politica-para-el-tratamiento-de-datos-personales"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-0 hover:text-[#C6F600] transition-colors cursor-pointer"
        >
          Política para el tratamiento de datos personales
        </a>
        <a
          href="https://www.eltelegrafo.com.ec/transparencia/codigo-deontologico"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#C6F600] transition-colors cursor-pointer"
        >
          Código deontológico
        </a>
      </div>
    </div>
  );
}

function MediaLogos() {
  return (
    <div className="flex items-center justify-center pt-4 md:pt-2  gap-4">
      <img src={etLogo} alt="El Télegrafo" className="h-8 w-auto object-contain" />
      <img src={ectvLogo} alt="ECTV" className="h-8 w-auto object-contain" />
    </div>
  );
}

function FooterLine1() {
  return (
    <div className="bg-[#1d1d1b] relative shrink-0 w-full" data-name="footer-Line 2">
      <div className="flex flex-row items-center justify-center overflow-clip gap-4 rounded-[inherit] size-full">
        <div className="box-border content-stretch flex flex-col md:flex-row gap-6 text-sm md:text-base items-center justify-center px-4  py-4 relative w-full">
          <Direccion />
          <Publicidad />
          <MediaLogos />
          <Legal />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#484544] border-[1px_0px] border-solid  inset-0 pointer-events-none" />
    </div>
  );
}

function SocialIcon({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="relative shrink-0 size-[32px]  cursor-pointer hover:opacity-80 transition-opacity"
      aria-label={label}
    >
      <img src={icon} alt={label} className="w-full h-full object-contain" />
    </a>
  );
}

function RedesSociales() {
  return (
    <div className="content-stretch flex flex-col md:flex-row gap-[5px] items-center justify-center relative shrink-0 w-full" data-name="Redes sociales">
      <div className="flex flex-col justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-white">
        <p className="leading-[25px]">Siguenos en:</p>
      </div>
      <div className="box-border content-stretch flex gap-[16px] items-center p-[4px] relative shrink-0" data-name="LOGOS">
        <SocialIcon href="https://www.facebook.com/diarioeltelegrafo" label="Facebook El Telégrafo" icon={facebookIcon} />
        <SocialIcon href="https://www.instagram.com/el_telegrafo/" label="Instagram El Telégrafo" icon={instagramIcon} />
        <SocialIcon href="https://www.tiktok.com/@el_telegrafo" label="TikTok El Telégrafo" icon={tiktokIcon} />
        <SocialIcon href="https://www.youtube.com/@ElTelegrafoEC" label="YouTube El Telégrafo" icon={youtubeIcon} />
        <SocialIcon href="https://x.com/el_telegrafo" label="X El Telégrafo" icon={xIcon} />
      </div>
    </div>
  );
}

function FooterLine2() {
  return (
    <div className="bg-[#1d1d1b] relative shrink-0 w-full" data-name="footer-Line 3">
      <div className="flex flex-col items-center overflow-clip rounded-[inherit] size-full">
        <div className="box-border content-stretch flex flex-col gap-[10px] items-center px-[4px] py-[32px] relative w-full">
          <RedesSociales />
          <div className="flex flex-col justify-center leading-[0] not-italic relative shrink-0 text-[#484544] text-xs md:text-base text-center">
            <p className="leading-[25px]">© 2026 COMUNICA EP. Todos los derechos reservados</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <div className="content-stretch flex flex-col items-end relative size-full mt-10" data-name="Footer">
      <FooterLine />
      <FooterLine1 />
      <FooterLine2 />
    </div>
  );
}
