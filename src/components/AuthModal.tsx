import { useRef } from "react";
import authBanner from "../assets/Logofanatico.svg";
import { ModalFlipFrame } from "../features/bracket/components/ModalFlipFrame";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  authMode: "login" | "signup";
  authEmail: string;
  authPassword: string;
  authBusy: boolean;
  authError: string | null;
  authSuccess: string | null;
  consentMarketing: boolean;
  consentNews: boolean;
  consentUpdates: boolean;
  onModeChange: (mode: "login" | "signup") => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConsentMarketingChange: (value: boolean) => void;
  onConsentNewsChange: (value: boolean) => void;
  onConsentUpdatesChange: (value: boolean) => void;
  onSubmit: () => void;
  onOAuth: (provider: "google" | "facebook") => void;
};

export const AuthModal = ({
  open,
  onClose,
  authMode,
  authEmail,
  authPassword,
  authBusy,
  authError,
  authSuccess,
  consentMarketing,
  consentNews,
  consentUpdates,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onConsentMarketingChange,
  onConsentNewsChange,
  onConsentUpdatesChange,
  onSubmit,
  onOAuth,
}: AuthModalProps) => {
  if (!open) return null;
  const overlayRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-10 flex items-center justify-center px-4"
    >
      <ModalFlipFrame
        disableFlip
        className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-xl md:max-w-none shadow-lg flex flex-col overflow-hidden modal-glow"
      >
        <div className="w-full overflow-hidden border-b p-4 border-neutral-700">
          <img src={authBanner} alt="Autenticación" className="w-full h-full object-containt" />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-[#c6f600]">
              {authMode === "signup" ? "Crear usuario" : "Iniciar sesión"}
            </h3>
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-white">
              X
            </button>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Crea tu cuenta directamente con Google o Facebook. Usaremos los datos del navegador/proveedor.
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onOAuth("google")}
              disabled={authBusy}
              className="w-full px-3 py-2 rounded-md border border-neutral-700 text-sm text-gray-200 hover:border-[#c6f600]"
            >
              Continuar con Google
            </button>
            <button
              type="button"
              onClick={() => onOAuth("facebook")}
              disabled={authBusy}
              className="w-full px-3 py-2 rounded-md border border-neutral-700 text-sm text-gray-200 hover:border-[#c6f600]"
            >
              Continuar con Facebook
            </button>
          </div>

          <div className="my-4 flex items-center gap-2 text-[11px] text-gray-500">
            <div className="h-px flex-1 bg-neutral-800" />
            <span>o usa correo</span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => onModeChange("login")}
              className={`px-3 py-2 rounded-md border text-xs font-semibold ${
                authMode === "login"
                  ? "border-[#c6f600] text-black bg-[#c6f600]"
                  : "border-neutral-700 text-gray-300"
              }`}
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              onClick={() => onModeChange("signup")}
              className={`px-3 py-2 rounded-md border text-xs font-semibold ${
                authMode === "signup"
                  ? "border-[#c6f600] text-black bg-[#c6f600]"
                  : "border-neutral-700 text-gray-300"
              }`}
            >
              Crear usuario
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-xs text-gray-400">Correo</label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={authEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white"
              placeholder="tu@email.com"
            />
            <label className="text-xs text-gray-400">Contrasena</label>
            <input
              type="password"
              name="password"
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              value={authPassword}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white"
              placeholder="********"
            />
          </div>

          {authMode === "signup" && (
            <div className="mt-4 space-y-2 text-xs text-gray-300">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={consentUpdates}
                  onChange={(e) => onConsentUpdatesChange(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Quiero recibir informativos y actualizaciones del producto.</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={consentNews}
                  onChange={(e) => onConsentNewsChange(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Quiero recibir noticias relevantes por correo.</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={consentMarketing}
                  onChange={(e) => onConsentMarketingChange(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Acepto recibir publicidad y promociones.</span>
              </label>
              <p className="text-[10px] text-gray-500">
                Puedes cambiar estas preferencias cuando quieras.
              </p>
            </div>
          )}

          {authError && <p className="text-xs text-red-400 mt-3">{authError}</p>}
          {authSuccess && <p className="text-xs text-green-400 mt-3">{authSuccess}</p>}

          <button
            type="button"
            onClick={onSubmit}
            disabled={authBusy}
            className={`mt-4 w-full px-3 py-2 rounded-md font-semibold ${
              authBusy ? "bg-neutral-700 text-gray-400" : "bg-[#c6f600] text-black hover:brightness-95"
            }`}
          >
            {authMode === "signup" ? "Crear cuenta" : "Iniciar sesion"}
          </button>
        </div>
      </ModalFlipFrame>
    </div>
  );
};
