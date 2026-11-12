import { lazy, Suspense, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch, useLocation } from "wouter";
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
import AccountExclusive from "./pages/account/AccountExclusive";
import AccountLists from "./pages/account/AccountLists";
import AccountListDetail, {
  AccountListSharePage,
} from "./pages/account/AccountListDetail";
import AccountReferrals from "./pages/account/AccountReferrals";
import AccountNotifications from "./pages/account/AccountNotifications";
import AccountPrivacy from "./pages/account/AccountPrivacy";
import AccountOrganization from "./pages/account/AccountOrganization";
import AccountMealPlans from "./pages/account/AccountMealPlans";
import AccountPlanBuilder from "./pages/account/AccountPlanBuilder";
import AccountShoppingCart from "./pages/account/AccountShoppingCart";
import AccountMyMeals from "./pages/account/AccountMyMeals";
import AccountRecipeBuilder from "./pages/account/AccountRecipeBuilder";
import AccountBenchmarks from "./pages/account/AccountBenchmarks";
import AccountBenchmarkCatalog from "./pages/account/AccountBenchmarkCatalog";
import AccountWorkouts from "./pages/account/AccountWorkouts";
import AccountWorkoutBuilder from "./pages/account/AccountWorkoutBuilder";
import AccountQuickLog from "./pages/account/AccountQuickLog";
import AccountWorkoutLog from "./pages/account/AccountWorkoutLog";
import AccountTrainingPlanBuilder from "./pages/account/AccountTrainingPlanBuilder";
import AccountCoaching from "./pages/account/AccountCoaching";
import AccountSpark from "./pages/account/AccountSpark";
import AccountInbox from "./pages/account/AccountInbox";
import AccountMessages from "./pages/account/AccountMessages";
import CheckoutComplete from "./pages/checkout/CheckoutComplete";
import MemberProfilePage from "./pages/members/MemberProfilePage";
import { captureBsiRef } from "./lib/referralAttribution";

/** Detail + DOMPurify in a separate chunk (PX8 / CQ14). */
const PostDetailPage = lazy(() => import("./pages/posts/PostDetailPage"));
const LibraryDetailPage = lazy(
  () => import("./pages/library/LibraryDetailPage"),
);
const LibraryTaxonomyPage = lazy(
  () => import("./pages/library/LibraryTaxonomyPage"),
);
const SearchPage = lazy(() => import("./pages/search/SearchPage"));
const FindAGymPage = lazy(() => import("./pages/find-a-gym/FindAGymPage"));

function BsiRefCapture() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof sessionStorage === "undefined") return;
    captureBsiRef(window.location.search, sessionStorage);
  }, []);
  return null;
}

/** Client-route pageviews — head snippets already track the first load. */
function SpaPageviews() {
  const [location] = useLocation();
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    window.whop?.track("page");
    window.fbq?.("track", "PageView");
  }, [location]);
  return null;
}

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
      <Route path={"/find-a-gym"}>
        {() => (
          <Suspense fallback={null}>
            <FindAGymPage />
          </Suspense>
        )}
      </Route>
      <Route path={"/the-daily-fix/:yy/:mm/:dd"} component={TheDailyFixPage} />
      <Route
        path={"/the-daily-fix/:date/:pillar"}
        component={TheDailyFixPage}
      />
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
      <Route path={"/checkout/complete"} component={CheckoutComplete} />
      <Route path={"/account/billing"} component={AccountBilling} />
      <Route path={"/account/profile"} component={AccountProfile} />
      <Route path={"/account/courses"} component={AccountCourses} />
      <Route path={"/account/favorites"} component={AccountFavorites} />
      <Route path={"/account/exclusive"} component={AccountExclusive} />
      <Route path={"/account/lists/share/:token"} component={AccountListSharePage} />
      <Route path={"/account/lists/:id"} component={AccountListDetail} />
      <Route path={"/account/lists"} component={AccountLists} />
      <Route path={"/account/organization"} component={AccountOrganization} />
      <Route path={"/account/referrals"} component={AccountReferrals} />
      <Route path={"/account/notifications"} component={AccountNotifications} />
      <Route path={"/account/privacy"} component={AccountPrivacy} />
      <Route path={"/account/meals"} component={AccountMyMeals} />
      <Route path={"/account/meal-plans/new"} component={AccountPlanBuilder} />
      <Route path={"/account/meal-plans/:id/edit"} component={AccountPlanBuilder} />
      <Route path={"/account/meal-plans"} component={AccountMealPlans} />
      <Route path={"/account/shopping-cart"} component={AccountShoppingCart} />
      <Route path={"/account/my-meals/recipes/new"} component={AccountRecipeBuilder} />
      <Route path={"/account/my-meals/recipes/:id/edit"} component={AccountRecipeBuilder} />
      <Route path={"/account/my-meals"} component={AccountMyMeals} />
      <Route path={"/account/benchmarks/all"} component={AccountBenchmarkCatalog} />
      <Route path={"/account/benchmarks"} component={AccountBenchmarks} />
      <Route path={"/account/prs"} component={AccountBenchmarks} />
      <Route path={"/account/workouts/builder/:id"} component={AccountWorkoutBuilder} />
      <Route path={"/account/workouts/builder"} component={AccountWorkoutBuilder} />
      <Route path={"/account/workouts/log"} component={AccountQuickLog} />
      <Route path={"/account/workouts/:id"} component={AccountWorkoutLog} />
      <Route path={"/account/workouts"} component={AccountWorkouts} />
      <Route path={"/account/plans/:planId"} component={AccountTrainingPlanBuilder} />
      <Route path={"/account/coaching"} component={AccountCoaching} />
      <Route path={"/account/spark"} component={AccountSpark} />
      <Route path={"/account/inbox"} component={AccountInbox} />
      <Route path={"/account/messages/:id"} component={AccountMessages} />
      <Route path={"/account/messages"} component={AccountMessages} />
      <Route path={"/account/chat/:id"} component={AccountMessages} />
      <Route path={"/account/chat"} component={AccountMessages} />
      <Route path={"/account"} component={AccountOverview} />
      <Route path={"/members/:memberId"} component={MemberProfilePage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  // Pathname only — `/join?x=1` still hides nav without a dead `/join?` startsWith (WJ15).
  const pathOnly = location.split("?")[0] ?? location;
  const hideGlobalNav =
    pathOnly === "/login" ||
    pathOnly === "/checkout/complete" ||
    pathOnly.startsWith("/checkout/") ||
    pathOnly === "/members" ||
    pathOnly.startsWith("/members/") ||
    pathOnly === "/join";
  return (
    <>
      <BsiRefCapture />
      <SpaPageviews />
      {hideGlobalNav ? null : <GlobalNav />}
      <AppRoutes />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
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
