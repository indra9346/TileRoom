import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { AuthProvider } from "@/context/AuthContext";
import { WorkflowProvider } from "@/context/WorkflowContext";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { PromoBanner } from "@/components/layout/PromoBanner";
import { DoorReveal } from "@/components/layout/DoorReveal";
import { RoomTransitionProvider } from "@/components/layout/RoomTransition";
import { ConfigWarningBanner } from "@/components/layout/ConfigWarningBanner";
import { Footer } from "@/components/layout/Footer";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { SmokeEffect } from "@/components/ui/SmokeEffect";
import { LandingPage } from "@/pages/LandingPage";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageTransition } from "@/components/ui/motion";

const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const UploadPage = lazy(() => import("@/pages/UploadPage").then((m) => ({ default: m.UploadPage })));
const AnalysisPage = lazy(() => import("@/pages/AnalysisPage").then((m) => ({ default: m.AnalysisPage })));
const TilesPage = lazy(() => import("@/pages/TilesPage").then((m) => ({ default: m.TilesPage })));
const TileCatalogPage = lazy(() => import("@/pages/TileCatalogPage").then((m) => ({ default: m.TileCatalogPage })));
const MyTilesPage = lazy(() => import("@/pages/MyTilesPage").then((m) => ({ default: m.MyTilesPage })));
const ResultPage = lazy(() => import("@/pages/ResultPage").then((m) => ({ default: m.ResultPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const CreditsPage = lazy(() => import("@/pages/CreditsPage").then((m) => ({ default: m.CreditsPage })));
const PaymentsPage = lazy(() => import("@/pages/PaymentsPage").then((m) => ({ default: m.PaymentsPage })));
const MyVisualizationsPage = lazy(() => import("@/pages/MyVisualizationsPage").then((m) => ({ default: m.MyVisualizationsPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const CalculatorPage = lazy(() => import("@/pages/CalculatorPage").then((m) => ({ default: m.CalculatorPage })));
const DemosPage = lazy(() => import("@/pages/DemosPage").then((m) => ({ default: m.DemosPage })));

const SPLASH_KEY = "tileroom_splash_shown";

type IntroPhase = "splash" | "promo" | "doorReveal" | "done";

function PageFallback() {
  return (
    <div className="container-page space-y-4 py-10 sm:py-14" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-56 w-full rounded-3xl sm:h-64" />
      <Skeleton className="h-8 w-2/3 max-w-md" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Key for the page-enter animation. Parameterised routes collapse
 * to one key per route ("/tiles/:id", "/result/:id"…), so moving between two
 * rooms or two results keeps the same mounted page — exactly as before the
 * transitions were added — while every top-level destination animates.
 */
function transitionKey(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length > 1 ? `/${parts[0]}/:id` : `/${parts[0] ?? ""}`;
}

function AppShell() {
  const location = useLocation();
  const pageKey = transitionKey(location.pathname);

  // A new page starts at the top, like a normal navigation, but never yank the view for an in-page anchor.
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pageKey]);
  const [introPhase, setIntroPhase] = useState<IntroPhase>(() => {
    try {
      return sessionStorage.getItem(SPLASH_KEY) === "1" ? "done" : "splash";
    } catch {
      return "splash";
    }
  });

  const finishIntro = () => {
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      /* ignore */
    }
    setIntroPhase("done");
  };

  return (
    <RoomTransitionProvider>
      {introPhase === "splash" && <SplashScreen onFinish={() => setIntroPhase("promo")} />}
      {introPhase === "promo" && <PromoBanner onFinish={() => setIntroPhase("doorReveal")} />}
      {introPhase === "doorReveal" && <DoorReveal onComplete={finishIntro} />}
      <div className="flex min-h-screen relative">
        <Sidebar />
        <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
          <ConfigWarningBanner />
          <Navbar />
          <div className="flex-1 relative z-10">
            <ErrorBoundary>
              {/* Enter-only page animation. Deliberately NOT AnimatePresence mode="wait": an exit that never
                  completes (redirects during the exit, lazy routes suspending, a hidden tab pausing animation
                  frames) would leave the old page faded out and the new page never mounted, i.e. a blank screen. */}
              <PageTransition key={pageKey}>
                  <Suspense fallback={<PageFallback />}>
                    <Routes location={location}>
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/demos" element={<DemosPage />} />
                      <Route path="/calculator" element={<CalculatorPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/tiles" element={<TileCatalogPage />} />
                      <Route path="/my-tiles" element={<ProtectedRoute><MyTilesPage /></ProtectedRoute>} />
                      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                      <Route path="/credits" element={<ProtectedRoute><CreditsPage /></ProtectedRoute>} />
                      <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
                      <Route path="/my-visualizations" element={<MyVisualizationsPage />} />
                      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                      <Route
                        path="/projects"
                        element={
                          <ProtectedRoute>
                            <ProjectsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/upload"
                        element={
                          <ProtectedRoute>
                            <UploadPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/analysis/:roomId"
                        element={
                          <ProtectedRoute>
                            <AnalysisPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/tiles/:roomId"
                        element={
                          <ProtectedRoute>
                            <TilesPage />
                          </ProtectedRoute>
                        }
                      />
                      {/* Unprotected: the API itself decides access (owner, or anonymous
                          if the visualization was made public) — see vizGet.ts. */}
                      <Route path="/result/:visualizationId" element={<ResultPage />} />
                    </Routes>
                  </Suspense>
              </PageTransition>
            </ErrorBoundary>
          </div>
          <Footer />
          <SmokeEffect />
        </div>
      </div>
    </RoomTransitionProvider>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <WorkflowProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </WorkflowProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
