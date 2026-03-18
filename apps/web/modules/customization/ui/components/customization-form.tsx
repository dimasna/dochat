"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Separator } from "@workspace/ui/components/separator";
import { Textarea } from "@workspace/ui/components/textarea";
import { Switch } from "@workspace/ui/components/switch";
import { ImageIcon, XIcon } from "lucide-react";
import { FormSchema } from "../../types";
import { widgetSettingsSchema } from "../../schemas";

interface WidgetSettings {
  greetMessage?: string;
  suggestion1?: string | null;
  suggestion2?: string | null;
  suggestion3?: string | null;
  themeColor?: string | null;
  widgetLogo?: string | null;
  voiceEnabled?: boolean;
}

interface CustomizationFormProps {
  agentId?: string;
  initialData?: WidgetSettings | null;
}

export const CustomizationForm = ({
  agentId,
  initialData,
}: CustomizationFormProps) => {
  const queryClient = useQueryClient();
  const form = useForm<FormSchema>({
    resolver: zodResolver(widgetSettingsSchema),
    defaultValues: {
      greetMessage:
        initialData?.greetMessage || "Hi! How can I help you today?",
      defaultSuggestions: {
        suggestion1: initialData?.suggestion1 || "",
        suggestion2: initialData?.suggestion2 || "",
        suggestion3: initialData?.suggestion3 || "",
      },
      themeColor: initialData?.themeColor || "",
      widgetLogo: initialData?.widgetLogo || "",
      voiceEnabled: initialData?.voiceEnabled || false,
    },
  });

  const onSubmit = async (values: FormSchema) => {
    try {
      const res = await fetch("/api/widget-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          greetMessage: values.greetMessage,
          suggestion1: values.defaultSuggestions.suggestion1 || null,
          suggestion2: values.defaultSuggestions.suggestion2 || null,
          suggestion3: values.defaultSuggestions.suggestion3 || null,
          themeColor: values.themeColor || null,
          widgetLogo: values.widgetLogo || null,
          voiceEnabled: values.voiceEnabled || false,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success("Widget settings saved");
      queryClient.invalidateQueries({ queryKey: ["widget-settings"] });
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="greetMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Greeting Message</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Welcome message shown when chat opens"
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>
                    The first message customers see when they open the chat
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="themeColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Theme Color</FormLabel>
                  <div className="flex items-center gap-3">
                    <div
                      className="relative size-9 shrink-0 overflow-hidden rounded-md border cursor-pointer"
                      style={{ backgroundColor: field.value || "#3b82f6" }}
                    >
                      <FormControl>
                        <input
                          type="color"
                          className="absolute inset-0 size-full cursor-pointer opacity-0"
                          value={field.value || "#3b82f6"}
                          onChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                    <Input
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="#3b82f6"
                      className="w-32 font-mono text-sm"
                    />
                    {field.value && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => field.onChange("")}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  <FormDescription>
                    Customize the primary color of your chat widget
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="widgetLogo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Widget Logo</FormLabel>
                  <div className="flex items-center gap-4">
                    <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                      {field.value ? (
                        <>
                          <img
                            src={field.value}
                            alt="Widget logo"
                            className="size-full object-contain p-1"
                          />
                          <button
                            type="button"
                            className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                            onClick={() => field.onChange("")}
                          >
                            <XIcon className="size-3" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <FormControl>
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          className="text-sm"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 512 * 1024) {
                              toast.error("Logo must be under 512KB");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              field.onChange(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </FormControl>
                    </div>
                  </div>
                  <FormDescription>
                    Upload a logo for your chat widget header (PNG, JPG, SVG, WebP, max 512KB)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="mb-4 text-sm">Default Suggestions</h3>
                <p className="mb-4 text-muted-foreground text-sm">
                  Quick reply suggestions shown to customers
                </p>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="defaultSuggestions.suggestion1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suggestion 1</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., How do I get started?"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="defaultSuggestions.suggestion2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suggestion 2</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., What are your pricing plans?"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="defaultSuggestions.suggestion3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suggestion 3</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., I need help with my account"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="voiceEnabled"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <div>
                      <FormLabel>Voice Chat</FormLabel>
                      <FormDescription>
                        Allow visitors to use voice input and hear voice responses
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

        <div className="flex justify-end">
          <Button disabled={form.formState.isSubmitting} type="submit">
            Save Settings
          </Button>
        </div>
      </form>
    </Form>
  );
};
