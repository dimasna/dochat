import { z } from "zod";

export const widgetSettingsSchema = z.object({
  greetMessage: z.string().min(1, "Greeting message is required"),
  defaultSuggestions: z.object({
    suggestion1: z.string().optional(),
    suggestion2: z.string().optional(),
    suggestion3: z.string().optional(),
  }),
  themeColor: z.string().optional(),
  widgetLogo: z.string().optional(),
  voiceEnabled: z.boolean().optional(),
});
