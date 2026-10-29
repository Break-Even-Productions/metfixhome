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
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const openJoinFlow = useCallback(() => {
    // WJ15: capture opener while it still has focus (before click blur).
    const el = document.activeElement;
    setReturnFocusTo(el instanceof HTMLElement ? el : null);
    setOpen(true);
  }, []);
  const closeJoinFlow = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ openJoinFlow, closeJoinFlow, isOpen: open }),
    [openJoinFlow, closeJoinFlow, open],
  );
  return (
    <JoinFlowContext.Provider value={value}>
      {children}
      <JoinFlow open={open} onClose={closeJoinFlow} returnFocusTo={returnFocusTo} />
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
