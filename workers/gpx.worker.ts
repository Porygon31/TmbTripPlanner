import { DOMParser } from "@xmldom/xmldom";
import { parseGpx } from "../lib/tmb/gpx";
declare const self: {
  onmessage:
    | ((event: MessageEvent<{ text: string; name: string }>) => void)
    | null;
  postMessage: (data: unknown) => void;
};
self.onmessage = (e) => {
  try {
    self.postMessage({
      route: parseGpx(
        e.data.text,
        e.data.name,
        DOMParser as unknown as typeof globalThis.DOMParser,
      ),
    });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
