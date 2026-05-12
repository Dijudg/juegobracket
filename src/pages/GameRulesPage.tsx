import { ArrowLeft, CheckCircle2, Medal, ShieldCheck, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import Header from "../components/header";
import Footer from "../components/Footer";
import { useNavigation } from "../contexts/NavigationContext";

const scoringRules = [
  ["Marcador Acertado", "5"],
  ["Ganador Acertado", "2"],
  ["Gol Acertado", "1"],
  ["Penales Exactos", "1"],
  ["Predicción Única", "5"],
  ["Bono Octavos", "8"],
  ["Bono Cuartos", "4"],
  ["Bono Semifinal", "2"],
  ["Bono Final", "5"],
];

const tieBreakers = [
  "Campeón: si existe un empate en puntaje, gana la posición quien haya acertado el campeón del torneo.",
  "Marcador acertado: si persiste el empate, gana quien tenga más marcadores exactos acertados.",
  "Ganador acertado: si persiste el empate, gana quien tenga más ganadores acertados.",
  "Gol acertado: si persiste el empate, gana quien tenga más goles acertados.",
  "Marcador único: si persiste el empate, gana quien tenga más marcadores únicos.",
  "Si después de evaluar estos criterios todavía persiste el empate, los jugadores quedan en la misma posición.",
];

function RuleCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-black/70 p-5 shadow-[0_0_28px_rgba(198,246,0,0.08)]">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full border border-[#c6f600]/60 bg-[#c6f600]/10 text-[#c6f600]">
          {icon}
        </span>
        <h2 className="text-xl font-black uppercase text-white">{title}</h2>
      </div>
      <div className="mt-4 text-sm leading-6 text-gray-200">{children}</div>
    </section>
  );
}

export default function GameRulesPage() {
  const { navigateTo } = useNavigation();

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 py-4 md:px-8">
        <Header showSearch={false} />

        <main className="rounded-xl border border-white/10 bg-neutral-950/80 px-4 py-6 md:px-8 md:py-10">
          <button
            type="button"
            onClick={() => navigateTo("home")}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-[#c6f600] hover:text-[#c6f600]"
          >
            <ArrowLeft className="size-4" />
            Volver al juego
          </button>

          <div className="mt-8 max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#c6f600]">Modo completo</p>
            <h1 className="mt-2 text-4xl font-black uppercase text-white md:text-6xl">Reglas del juego completo</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-gray-300 md:text-lg">
              En este modo se predicen marcadores por partido, equipos clasificados por fase y bonos. Las predicciones se
              bloquean 15 minutos antes de cada partido usando la hora del sistema.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <RuleCard icon={<ShieldCheck className="size-5" />} title="Reglas generales">
              <p>
                Para el cálculo de puntos se utiliza el resultado real del partido al finalizar los 90 o 120 minutos. Si
                el partido se define por penaltis, el marcador de penales exacto suma un punto adicional.
              </p>
            </RuleCard>

            <RuleCard icon={<CheckCircle2 className="size-5" />} title="Predicciones">
              <p>
                El usuario puede realizar y cambiar sus predicciones hasta 15 minutos antes de iniciar el partido. Si no
                realiza una predicción para un partido, no suma puntos.
              </p>
            </RuleCard>

            <RuleCard icon={<Trophy className="size-5" />} title="Clasificados">
              <p>
                En octavos, cuartos, semifinal y final, el usuario selecciona el equipo que clasifica a la siguiente ronda.
                Esta selección solo influye en los bonos de cada fase.
              </p>
            </RuleCard>
          </div>

          <section className="mt-8 rounded-lg border border-[#c6f600]/25 bg-black/80 p-5">
            <h2 className="text-2xl font-black uppercase text-[#c6f600]">Puntajes</h2>
            <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/10 text-xs uppercase text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Regla</th>
                    <th className="w-28 px-4 py-3 text-right">Puntaje</th>
                  </tr>
                </thead>
                <tbody>
                  {scoringRules.map(([rule, points]) => (
                    <tr key={rule} className="border-t border-white/10">
                      <td className="px-4 py-3 font-semibold text-white">{rule}</td>
                      <td className="px-4 py-3 text-right font-black text-[#c6f600]">{points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <RuleCard icon={<Medal className="size-5" />} title="Descripción de reglas">
              <div className="space-y-3">
                <p>
                  <strong className="text-white">Marcador exacto:</strong> si aciertas exactamente el marcador, sumas los
                  puntos seleccionados.
                </p>
                <p>
                  <strong className="text-white">Ganador:</strong> si no aciertas el marcador exacto, pero aciertas el
                  ganador o el empate, sumas los puntos.
                </p>
                <p>
                  <strong className="text-white">Gol acertado:</strong> si no aciertas el marcador exacto, pero aciertas los
                  goles de uno de los equipos, sumas los puntos.
                </p>
                <p>
                  <strong className="text-white">Penales exactos:</strong> si el partido llega a penaltis y aciertas
                  exactamente la tanda, sumas un punto adicional.
                </p>
                <p>
                  <strong className="text-white">Predicción única:</strong> si fuiste el único que acertó el marcador exacto
                  dentro de tu grupo, sumas los puntos seleccionados.
                </p>
                <p>
                  <strong className="text-white">Bonos:</strong> si aciertas todos los equipos que pasan a la siguiente fase,
                  recibes el bono de esa fase. En la final corresponde al campeón.
                </p>
              </div>
            </RuleCard>

            <RuleCard icon={<Trophy className="size-5" />} title="Desempates">
              <ol className="space-y-3">
                {tieBreakers.map((rule, index) => (
                  <li key={rule} className="flex gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#c6f600] text-xs font-black text-black">
                      {index + 1}
                    </span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            </RuleCard>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
