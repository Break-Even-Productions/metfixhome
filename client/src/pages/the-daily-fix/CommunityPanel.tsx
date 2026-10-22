import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentThread } from "./CommentThread";
import { Leaderboard } from "./LeaderboardView";
import {
  fetchDailyFixLeaderboard,
  type LeaderboardLoadState,
} from "./leaderboard";
import type { CommentsLoadState } from "./comments";
import type { Pillar } from "./model";

type CommunityView = "comments" | "leaderboard";

type CommunityPanelProps = {
  load: CommentsLoadState;
  pillar: Pillar;
  dateIso: string | null;
  viewerDisplayName?: string | null;
  moderator?: boolean;
  signedIn: boolean;
  onCommentsChanged?: (next: CommentsLoadState) => void;
};

function hasLeaderboardEntries(state: LeaderboardLoadState): boolean {
  return state.status === "loaded" && state.rows.length > 0;
}

/**
 * Community chrome: Comments by default; Leaderboard only when the day has rows,
 * switched via the heading caret.
 */
export function CommunityPanel({
  load,
  pillar,
  dateIso,
  viewerDisplayName = null,
  moderator = false,
  signedIn,
  onCommentsChanged,
}: CommunityPanelProps) {
  const [view, setView] = useState<CommunityView>("comments");
  const [leaderboardAvailable, setLeaderboardAvailable] = useState(false);

  useEffect(() => {
    setView("comments");
    if (!signedIn || !dateIso) {
      setLeaderboardAvailable(false);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setLeaderboardAvailable(false);
    void fetchDailyFixLeaderboard(dateIso, pillar, "all", ac.signal).then((next) => {
      if (cancelled) return;
      const available = hasLeaderboardEntries(next);
      setLeaderboardAvailable(available);
      if (!available) setView("comments");
    });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [dateIso, pillar, signedIn]);

  const titleId = "df-community-title";

  return (
    <section className="df-comments" aria-labelledby={titleId}>
      <div className="df-comments-head">
        <p className="df-kicker">Community</p>
        {leaderboardAvailable ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              id={titleId}
              className="df-heading df-community-view"
              aria-label="Community view"
            >
              {view === "comments" ? "Comments" : "Leaderboard"}
              <ChevronDown className="df-community-view-caret" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              className="df-share-menu df-community-view-menu"
            >
              <DropdownMenuRadioGroup
                value={view}
                onValueChange={(value) => setView(value as CommunityView)}
              >
                <DropdownMenuRadioItem value="comments">Comments</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="leaderboard">Leaderboard</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <h3 id={titleId} className="df-heading">
            Comments
          </h3>
        )}
      </div>

      {view === "leaderboard" && leaderboardAvailable ? (
        <Leaderboard
          dateIso={dateIso}
          pillar={pillar}
          signedIn={signedIn}
          embedded
        />
      ) : (
        <CommentThread
          load={load}
          pillar={pillar}
          dateIso={dateIso}
          viewerDisplayName={viewerDisplayName}
          moderator={moderator}
          onCommentsChanged={onCommentsChanged}
          showHeader={false}
        />
      )}
    </section>
  );
}
