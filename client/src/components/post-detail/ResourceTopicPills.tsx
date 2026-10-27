import { Tag } from "lucide-react";
import { basePath } from "@/const";
import type { DetailReaderModel } from "./types";

export function ResourceTopicPills({ model }: { model: DetailReaderModel }) {
  if (model.topics.length === 0) return null;
  return (
    <div className="post-detail-topics" data-testid="resource-topic-pills">
      {model.topics.map((topic) => (
        <a
          key={topic.id}
          className="post-detail-topic-pill"
          href={basePath(`/topic/${topic.slug}`)}
        >
          <Tag size={12} strokeWidth={2.25} aria-hidden />
          {topic.name}
        </a>
      ))}
    </div>
  );
}
