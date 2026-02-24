import LogotipoFanaticos from "../imports/LogotipoFanaticos";
import facebookIcon from "../assets/facebook.svg";
import instagramIcon from "../assets/instagram.svg";
import xIcon from "../assets/x.svg";
import tiktokIcon from "../assets/tiktok.svg";
import youtubeIcon from "../assets/youtube.svg";

const socialLinks = [
  { href: "https://www.facebook.com/diarioeltelegrafo", label: "Facebook", icon: facebookIcon },
  { href: "https://www.instagram.com/el_telegrafo/", label: "Instagram", icon: instagramIcon },
  { href: "https://x.com/el_telegrafo", label: "X", icon: xIcon },
  { href: "https://www.tiktok.com/@el_telegrafo", label: "TikTok", icon: tiktokIcon },
  { href: "https://www.youtube.com/@ElTelegrafoEC", label: "YouTube", icon: youtubeIcon },
];

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-neutral-800 pt-6 pb-10 text-gray-400">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="w-44 md:w-56">
          <LogotipoFanaticos />
        </div>
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
