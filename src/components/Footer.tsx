import { useState, type FormEvent } from "react";
import LogotipoFanaticos from "../imports/LogotipoFanaticos";
import facebookIcon from "../assets/facebook.svg";
import instagramIcon from "../assets/instagram.svg";
import xIcon from "../assets/x.svg";
import tiktokIcon from "../assets/tiktok.svg";
import youtubeIcon from "../assets/youtube.svg";
import { resolveApiBase } from "../utils/apiBase";

const socialLinks = [
  { href: "https://www.facebook.com/diarioeltelegrafo", label: "Facebook", icon: facebookIcon },
  { href: "https://www.instagram.com/el_telegrafo/", label: "Instagram", icon: instagramIcon },
  { href: "https://x.com/el_telegrafo", label: "X", icon: xIcon },
  { href: "https://www.tiktok.com/@el_telegrafo", label: "TikTok", icon: tiktokIcon },
  { href: "https://www.youtube.com/@ElTelegrafoEC", label: "YouTube", icon: youtubeIcon },
];

export default function Footer() {
  const [codeInput, setCodeInput] = useState("");
  const [lookupStatus, setLookupStatus] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  const handleLookupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      setLookupStatus("Ingresa tu código.");
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
        if (res.status === 404) throw new Error("No encontramos ese código.");
        throw new Error(message || "No pudimos revisar el bracket.");
      }
      const data = (await res.json()) as { id?: string; sharePageUrl?: string };
      const targetUrl = data.sharePageUrl || (data.id ? new URL(`/share/${data.id}`, baseUrl).toString() : "");
      if (!targetUrl) throw new Error("No se pudo generar el enlace.");
      if (typeof window !== "undefined") {
        window.location.href = targetUrl;
      }
    } catch (err) {
      setLookupStatus(err instanceof Error ? err.message : "No pudimos revisar el bracket.");
    } finally {
      setLookupBusy(false);
    }
  };

  return (
    <footer className="mt-10 border-t border-neutral-800 pt-6 pb-10 text-gray-400">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="w-44 md:w-56">
          <LogotipoFanaticos />
        </div>
        <form
          onSubmit={handleLookupSubmit}
          className="w-full md:w-auto flex flex-col items-center md:items-start gap-2"
        >
          <span className="text-xs uppercase tracking-wide text-gray-500">Revisa tu bracket</span>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={codeInput}
              onChange={(event) => {
                setCodeInput(event.target.value);
                if (lookupStatus) setLookupStatus(null);
              }}
              placeholder="Código del juego"
              className="w-full md:w-52 rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-white"
            />
            <button
              type="submit"
              disabled={lookupBusy}
              className={`px-3 py-2 rounded-md text-xs font-semibold ${
                lookupBusy ? "bg-neutral-700 text-gray-300" : "bg-[#c6f600] text-black hover:brightness-95"
              }`}
            >
              {lookupBusy ? "Buscando..." : "Ver"}
            </button>
          </div>
          {lookupStatus && <span className="text-[11px] text-gray-500">{lookupStatus}</span>}
        </form>
        <div className="flex items-center gap-3">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              className="h-9 w-9 rounded-full border border-neutral-800 flex items-center justify-center hover:border-[#c6f600]"
            >
              <img src={link.icon} alt={link.label} className="h-5 w-5" />
            </a>
          ))}
        </div>
      </div>
      <div className="mt-4 text-xs text-gray-500 text-center">
        (c) 2026 Fanatico Mundialista - El Telegrafo
      </div>
    </footer>
  );
}
