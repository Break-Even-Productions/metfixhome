import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch } from "wouter";
import { getRouterBase } from "@/const";
import ErrorBoundary from "./components/ErrorBoundary";
import GlobalNav from "./components/GlobalNav";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import BecomeAnAffiliate from "./pages/BecomeAnAffiliate";
import Classes from "./pages/Classes";
import AffiliateSeminars from "./pages/AffiliateSeminars";
import Login from "./pages/Login";
import TheDailyFixPage from "./pages/the-daily-fix/TheDailyFixPage";
import PostsPage from "./pages/posts/PostsPage";
import LibraryPage from "./pages/library/LibraryPage";

/** Detail + DOMPurify in a separate chunk (PX8 / CQ14). */
const PostDetailPage = lazy(() => import("./pages/posts/PostDetailPage"));
const LibraryDetailPage = lazy(() => import("./pages/library/LibraryDetailPage"));
const LibraryTaxonomyPage = lazy(() => import("./pages/library/LibraryTaxonomyPage"));
const SearchPage = lazy(() => import("./pages/search/SearchPage"));
import { useLocation } from "wouter";

function AppRoutes() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/become-an-affiliate"} component={BecomeAnAffiliate} />
      <Route path={"/classes"} component={Classes} />
      <Route path={"/courses"} component={Classes} />
      <Route path={"/affiliate-seminars"} component={AffiliateSeminars} />
      <Route path={"/the-daily-fix/:yy/:mm/:dd"} component={TheDailyFixPage} />
      <Route path={"/the-daily-fix/:date/:pillar"} component={TheDailyFixPage} />
      <Route path={"/the-daily-fix/:date"} component={TheDailyFixPage} />
      <Route path={"/the-daily-fix"} component={TheDailyFixPage} />
      <Route path={"/posts/:id"}>
        {() => (
          <Suspense fallback={null}>
            <PostDetailPage />
          </Suspense>
        )}
      </Route>
      <Route path={"/posts"} component={PostsPage} />
      <Route path={"/library/search"}>
        {() => (
          <Suspense fallback={null}>
            <SearchPage />
          </Suspense>
        )}
      </Route>
      <Route path={"/topic/:slug"}>
        {() => (
          <Suspense fallback={null}>
            <LibraryTaxonomyPage taxonomyKind="topic" />
          </Suspense>
        )}
      </Route>
      <Route path={"/library/topic/:slug"}>
        {() => (
          <Suspense fallback={null}>
            <LibraryTaxonomyPage taxonomyKind="topic" />
          </Suspense>
        )}
      </Route>
      <Route path={"/library/content-type/:slug"}>
        {() => (
          <Suspense fallback={null}>
            <LibraryTaxonomyPage taxonomyKind="content-type" />
          </Suspense>
        )}
      </Route>
      <Route path={"/library/category/:slug"}>
        {() => (
          <Suspense fallback={null}>
            <LibraryTaxonomyPage taxonomyKind="category" />
          </Suspense>
        )}
      </Route>
      <Route path={"/library/:type/:id"}>
        {() => (
          <Suspense fallback={null}>
            <LibraryDetailPage />
          </Suspense>
        )}
      </Route>
      <Route path={"/library"} component={LibraryPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const hideGlobalNav = location === "/login" || location.startsWith("/login?");
  return (
    <>
      {hideGlobalNav ? null : <GlobalNav />}
      <AppRoutes />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router base={getRouterBase()}>
            <AppShell />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
