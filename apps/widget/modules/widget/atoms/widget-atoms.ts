import { atom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { WidgetScreen } from "@/modules/widget/types";
import { CONTACT_SESSION_KEY } from "../constants";

export interface WidgetSettingsData {
  greetMessage: string;
  suggestion1: string | null;
  suggestion2: string | null;
  suggestion3: string | null;
  vapiAssistantId: string | null;
  vapiPhoneNumber: string | null;
}

export interface ContactSessionData {
  sessionId: string;
  sessionToken: string;
}

export const screenAtom = atom<WidgetScreen>("loading");
export const organizationIdAtom = atom<string | null>(null);
export const agentIdAtom = atom<string | null>(null);
export const contactSessionAtomFamily = atomFamily((organizationId: string) => {
  return atomWithStorage<ContactSessionData | null>(`${CONTACT_SESSION_KEY}_${organizationId}`, null)
});
export const errorMessageAtom = atom<string | null>(null);
export const loadingMessageAtom = atom<string | null>(null);
export const conversationIdAtom = atom<string | null>(null);

export const widgetSettingsAtom = atom<WidgetSettingsData | null>(null);
export const vapiSecretsAtom = atom<{
  publicApiKey: string;
} | null>(null);
export const hasVapiSecretsAtom = atom((get) => get(vapiSecretsAtom) !== null);
