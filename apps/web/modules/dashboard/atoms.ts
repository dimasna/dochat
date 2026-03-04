import { atomWithStorage } from "jotai/utils";
import { STATUS_FILTER_KEY } from "./constants";

export const statusFilterAtom = atomWithStorage<
  "unresolved" | "escalated" | "resolved" | "all"
>(STATUS_FILTER_KEY, "all");
