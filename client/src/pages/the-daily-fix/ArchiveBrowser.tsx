import { useState } from "react";

type ArchiveBrowserProps = {
  onOpen: () => void;
};

export function ArchiveBrowser({ onOpen }: ArchiveBrowserProps) {
  const [text, setText] = useState("");

  return (
    <div>
      <div className="df-archive-head">
        <div className="df-archive-copy">
          <p className="df-kicker">The archive</p>
          <h2>Every day of the fix.</h2>
          <p>
            Each day is a recipe, a workout, and a reading. Search stays on this page; it does not
            load an archive until a credentialed caller exists outside this bundle.
          </p>
        </div>
      </div>

      <div className="df-search">
        <label htmlFor="daily-fix-search">Search</label>
        <input
          id="daily-fix-search"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search recipes, workouts, or readings"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="df-panel" role="status">
        <div className="df-status">
          <h3>Archive isn’t loaded</h3>
          <p>
            {text.trim()
              ? "Nothing can match yet — this site does not prefetch Daily Fix days."
              : "The archive list is empty on purpose. This page does not prefetch past days."}
          </p>
          <button type="button" className="df-btn df-btn-ink" style={{ marginTop: "1.25rem" }} onClick={onOpen}>
            Back to this day
          </button>
        </div>
      </div>
    </div>
  );
}
