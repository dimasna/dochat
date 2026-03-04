import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface VapiPhoneNumber {
  id: string;
  number: string;
  name: string;
  status: string;
}

interface VapiAssistant {
  id: string;
  name: string;
  model?: { model?: string };
  firstMessage?: string;
}

export const useVapiAssistants = () => {
  const { data = [], isLoading, error } = useQuery<VapiAssistant[]>({
    queryKey: ["vapi-assistants"],
    queryFn: async () => {
      const res = await fetch("/api/plugins/vapi/assistants");
      if (!res.ok) {
        toast.error("Failed to fetch assistants");
        throw new Error("Failed to fetch assistants");
      }
      return res.json();
    },
  });

  return { data, isLoading, error };
};

export const useVapiPhoneNumbers = () => {
  const { data = [], isLoading, error } = useQuery<VapiPhoneNumber[]>({
    queryKey: ["vapi-phone-numbers"],
    queryFn: async () => {
      const res = await fetch("/api/plugins/vapi/phone-numbers");
      if (!res.ok) {
        toast.error("Failed to fetch phone numbers");
        throw new Error("Failed to fetch phone numbers");
      }
      return res.json();
    },
  });

  return { data, isLoading, error };
};
