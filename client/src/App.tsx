import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch } from "wouter";
import { getRouterBase } from "@/const";
import ErrorBoundary from "./components/ErrorBoundary";
import GlobalNav from "./components/GlobalNav";
import { JoinFlowProvider } from "./contexts/JoinFlowContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import BecomeAnAffiliate from "./pages/BecomeAnAffiliate";
import Classes from "./pages/Classes";
import AffiliateSeminars from "./pages/AffiliateSeminars";
import Login from "./pages/Login";
import JoinPage from "./pages/join/JoinPage";
import TheDailyFixPage from "./pages/the-daily-fix/TheDailyFixPage";
import PostsPage from "./pages/posts/PostsPage";
import LibraryPage from "./pages/library/LibraryPage";
import AccountOverview from "./pages/account/AccountOverview";
import AccountBilling from "./pages/account/AccountBilling";
import AccountProfile from "./pages/account/AccountProfile";
import AccountCourses from "./pages/account/AccountCourses";
import AccountFavorites from "./pages/account/AccountFavorites";
import AccountReferrals from "./pages/account/AccountReferrals";
import AccountNotifications from "./pages/account/AccountNotifications";
import AccountPrivacy from "./pages/account/AccountPrivacy";
import MemberProfilePage from "./pages/members/MemberProfilePage";

/** Detail + DOMPurify in a separate chunk (PX8 / CQ14). */
const PostDetailPage = lazy(() => import("./pages/posts/PostDetailPage"));
const LibraryDetailPage = lazy(() => import("./pages/library/LibraryDetailPage"));
import { useLocation } from "wouter";

function AppRoutes() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/join"} component={JoinPage} />
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
      <Route path={"/library/:type/:id"}>
        {() => (
          <Suspense fallback={null}>
            <LibraryDetailPage />
          </Suspense>
        )}
      </Route>
      <Route path={"/library"} component={LibraryPage} />
      <Route path={"/account/billing"} component={AccountBilling} />
      <Route path={"/account/profile"} component={AccountProfile} />
      <Route path={"/account/courses"} component={AccountCourses} />
      <Route path={"/account/favorites"} component={AccountFavorites} />
      <Route path={"/account/referrals"} component={AccountReferrals} />
      <Route path={"/account/notifications"} component={AccountNotifications} />
      <Route path={"/account/privacy"} component={AccountPrivacy} />
      <Route path={"/account"} component={AccountOverview} />
      <Route path={"/members/:memberId"} component={MemberProfilePage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const hideGlobalNav =
    location === "/login" ||
    location.startsWith("/login?") ||
    location === "/account" ||
    location.startsWith("/account/") ||
    location === "/members" ||
    location.startsWith("/members/") ||
    location === "/join" ||
    location.startsWith("/join?");
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
            <JoinFlowProvider>
              <AppShell />
            </JoinFlowProvider>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
