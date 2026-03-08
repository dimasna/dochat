import { atomWithStorage } from "jotai/utils";
import { ACTIVE_AGENT_KEY, STATUS_FILTER_KEY } from "./constants";

export const statusFilterAtom = atomWithStorage<
  "unresolved" | "escalated" | "resolved" | "all"
>(STATUS_FILTER_KEY, "all");

export const activeAgentIdAtom = atomWithStorage<string | null>(
  ACTIVE_AGENT_KEY,
  null,
);
