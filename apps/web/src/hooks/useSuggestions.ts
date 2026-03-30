import { useEffect, useState } from "react";
import useDebounce from "./useDebounce";
import { apiGet } from "../services/api";

export type SuggestionOption = {
  value: string;
  label: string;
  id?: string;
  [key: string]: any;
};

type Params = {
  endpoint: string;
  query: string;
  enabled?: boolean;
  limit?: number;
};

export default function useSuggestions({ endpoint, query, enabled = true, limit = 8 }: Params) {
  const [options, setOptions] = useState<SuggestionOption[]>([]);
  const debounced = useDebounce(query, 250);

  useEffect(() => {
    if (!enabled || !endpoint) {
      setOptions([]);
      return;
    }
    const q = String(debounced || "").trim();
    const joiner = endpoint.includes("?") ? "&" : "?";
    apiGet(`${endpoint}${joiner}q=${encodeURIComponent(q)}&limit=${limit}`)
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data;
        setOptions(Array.isArray(list) ? list : []);
      })
      .catch(() => setOptions([]));
  }, [endpoint, debounced, enabled, limit]);

  return options;
}
