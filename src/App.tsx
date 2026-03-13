import { useEffect, useState } from "react";
import { NavigationProvider } from "./contexts/NavigationContext";
import BracketGamePage from "./pages/BracketGamePage";
import UserBackendPage from "./pages/UserBackendPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { FlagValues } from "flags/react";
import { flagValues } from "./flags";

declare global {
  interface Window {
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

export default function App() {
  const resolvePageFromPath = (path: string) => {
    if (path === "/user") return "backend";
    if (path === "/ranking") return "leaderboard";
    return "home";
  };
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window === "undefined") return "home";
    return resolvePageFromPath(window.location.pathname);
  });
  const [pageParams, setPageParams] = useState<Record<string, any>>({});

  const navigateTo = (page: string, params: Record<string, any> = {}) => {
    const nextPath = page === "backend" ? "/user" : page === "leaderboard" ? "/ranking" : "/";

    if (
      typeof window !== "undefined" &&
      nextPath === "/user" &&
      window.location.pathname !== nextPath &&
      typeof window.gtag_report_conversion === "function"
    ) {
      window.gtag_report_conversion(nextPath);
      return;
    }

    setCurrentPage(page);
    setPageParams(params);
    if (typeof window === "undefined") return;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePop = () => {
      setCurrentPage(resolvePageFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  return (
    <NavigationProvider currentPage={currentPage} pageParams={pageParams} navigateTo={navigateTo}>
      {currentPage === "backend" ? (
        <UserBackendPage />
      ) : currentPage === "leaderboard" ? (
        <LeaderboardPage />
      ) : (
        <BracketGamePage />
      )}
      <FlagValues values={flagValues} />
      <Analytics />
      <SpeedInsights />
    </NavigationProvider>
  );
}
