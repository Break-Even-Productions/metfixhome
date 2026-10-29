import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { parseJoinStepParam } from "@shared/join";
import { JoinFlow } from "@/join/JoinFlow";
import type { JoinStep } from "@/join/types";
import { usePageMeta } from "@/hooks/usePageMeta";
import { basePath } from "@/const";

export default function JoinPage() {
  usePageMeta({
    title: "Join MetFix",
    description:
      "Start your free month of MetFix — courses, The Daily Fix, and cumulative LTV toward course certificates.",
  });
  const [, setLocation] = useLocation();
  const search = useSearch();
  const initialStep = useMemo((): JoinStep | undefined => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return parseJoinStepParam(params.get("step")) ?? undefined;
  }, [search]);

  return (
    <JoinFlow
      open
      standalone
      initialStep={initialStep}
      onClose={() => setLocation(basePath("/"))}
    />
  );
}
