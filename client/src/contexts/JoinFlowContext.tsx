import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { JoinFlow } from "@/join/JoinFlow";

type JoinFlowContextValue = {
  openJoinFlow: () => void;
  closeJoinFlow: () => void;
  isOpen: boolean;
};

const JoinFlowContext = createContext<JoinFlowContextValue | null>(null);

export function JoinFlowProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openJoinFlow = useCallback(() => setOpen(true), []);
  const closeJoinFlow = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ openJoinFlow, closeJoinFlow, isOpen: open }),
    [openJoinFlow, closeJoinFlow, open],
  );
  return (
    <JoinFlowContext.Provider value={value}>
      {children}
      <JoinFlow open={open} onClose={closeJoinFlow} />
    </JoinFlowContext.Provider>
  );
}

export function useJoinFlow(): JoinFlowContextValue {
  const ctx = useContext(JoinFlowContext);
  if (!ctx) {
    throw new Error("useJoinFlow must be used within JoinFlowProvider");
  }
  return ctx;
}

/** Safe optional hook when provider may be absent in tests. */
export function useJoinFlowOptional(): JoinFlowContextValue | null {
  return useContext(JoinFlowContext);
}
