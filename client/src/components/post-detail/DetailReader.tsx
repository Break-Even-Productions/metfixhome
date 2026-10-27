import type { ReactNode } from "react";
import { AuthorAside } from "@/components/AuthorAside";
import type { DetailReaderModel } from "./types";
import { PostCommentsSection } from "./PostCommentsSection";
import { ResourceBreadcrumbs } from "./ResourceBreadcrumbs";
import { ResourceMediaStage } from "./ResourceMediaStage";
import { ResourceMetaRow } from "./ResourceMetaRow";
import { ResourceTopicPills } from "./ResourceTopicPills";

type DetailReaderProps = {
  model: DetailReaderModel;
  titleClassName?: string;
  showComments?: boolean;
  beforeTitle?: ReactNode;
  children: ReactNode;
};

export function DetailReader({
  model,
  titleClassName = "posts-title",
  showComments = true,
  beforeTitle = null,
  children,
}: DetailReaderProps) {
  return (
    <article className="post-reader" data-testid="post-reader">
      <div className="post-reader-grid">
        <div className="post-reader-main">
          <ResourceBreadcrumbs model={model} />
          <header className="posts-detail-header">
            {beforeTitle}
            <h1 className={titleClassName}>{model.title}</h1>
            <ResourceMetaRow model={model} />
          </header>
          <ResourceTopicPills model={model} />
          <ResourceMediaStage model={model} />
          {children}
          {showComments ? (
            <PostCommentsSection postId={model.id} locked={model.locked} />
          ) : null}
        </div>
        {model.author ? <AuthorAside name={model.author} /> : null}
      </div>
    </article>
  );
}
