import { useEffect } from "react";
import { useUploadQueue } from "../state/uploadQueue";

export function useUploadPumpOnStart() {
  const pump = useUploadQueue((s) => s.pump);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    pump();
  }, [pump]);
}
