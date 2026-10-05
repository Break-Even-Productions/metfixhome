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
import TheDailyFixPage from "./pages/the-daily-fix/TheDailyFixPage";

function AppRoutes() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/become-an-affiliate"} component={BecomeAnAffiliate} />
      <Route path={"/classes"} component={Classes} />
      <Route path={"/courses"} component={Classes} />
      <Route path={"/affiliate-seminars"} component={AffiliateSeminars} />
      <Route path={"/the-daily-fix/:yy/:mm/:dd"} component={TheDailyFixPage} />
      <Route path={"/the-daily-fix/:date/:pillar"} component={TheDailyFixPage} />
      <Route path={"/the-daily-fix/:date"} component={TheDailyFixPage} />
      <Route path={"/the-daily-fix"} component={TheDailyFixPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router base={getRouterBase()}>
            <GlobalNav />
            <AppRoutes />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
