import { useEffect, useState } from "react";
import { Link } from "wouter";
import type { DetailReaderModel, LibraryResource } from "@shared/library";
import { JoinModal } from "@/pages/library/JoinModal";
import { fetchLibraryPopular, fetchLibrarySearch } from "@/pages/library/api";
import { ResourceCard } from "@/pages/library/ResourceCard";

const RELATED = 3;

function keyOf(r: { type: string; id: number }): string {
  return `${r.type}:${r.id}`;
}

function mergeUnique(
  current: LibraryResource[],
  incoming: LibraryResource[],
  skip: string,
): LibraryResource[] {
  const seen = new Set(current.map(keyOf));
  seen.add(skip);
  const out = [...current];
  for (const row of incoming) {
    const key = keyOf(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= RELATED) break;
  }
  return out;
}

/**
 * Related resources under the reader (Emily ResourceDetail "Keep Learning").
 * Prefers the current piece's first topic, then fills from popular-by-views.
 */
export function KeepLearning({ model }: { model: DetailReaderModel }) {
  const [items, setItems] = useState<LibraryResource[]>([]);
  const [lockedTitle, setLockedTitle] = useState<string | null>(null);
  const topicKey = model.topics.map((t) => t.id).join(",");

  useEffect(() => {
    const controller = new AbortController();
    const skip = keyOf({ type: model.resourceType, id: model.id });
    const topicId = model.topics[0]?.id;

    void (async () => {
      try {
        let rows: LibraryResource[] = [];
        if (topicId != null) {
          const themed = await fetchLibrarySearch(
            { topics: [topicId], limit: 8 },
            controller.signal,
          );
          if (controller.signal.aborted) return;
          rows = mergeUnique([], themed.resources, skip);
        }
        if (rows.length < RELATED) {
          const popular = await fetchLibraryPopular({ limit: 8 }, controller.signal);
          if (controller.signal.aborted) return;
          rows = mergeUnique(rows, popular.resources, skip);
        }
        if (!controller.signal.aborted) setItems(rows.slice(0, RELATED));
      } catch {
        if (!controller.signal.aborted) setItems([]);
      }
    })();

    return () => controller.abort();
  }, [model.id, model.resourceType, topicKey]);

  if (items.length === 0) return null;

  return (
    <section className="keep-learning" aria-labelledby="keep-learning-title">
      <div className="keep-learning-head">
        <div>
          <p className="keep-learning-label">Keep Learning</p>
          <h2 id="keep-learning-title" className="keep-learning-title">
            Related Resources
          </h2>
        </div>
        <Link href="/library" className="keep-learning-browse">
          Browse All
        </Link>
      </div>
      <div className="library-rail">
        {items.map((resource) => (
          <ResourceCard
            key={keyOf(resource)}
            resource={resource}
            onOpenLocked={(r) => setLockedTitle(r.title)}
          />
        ))}
      </div>
      <JoinModal
        open={lockedTitle != null}
        title={lockedTitle ?? undefined}
        onClose={() => setLockedTitle(null)}
      />
    </section>
  );
}
