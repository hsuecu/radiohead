export type PutArgs = { path: string; uri?: string; bytes?: Uint8Array };
export type Delivery = {
  put: (a: PutArgs) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  verify: (path: string) => Promise<boolean>;
};

export async function getDelivery(method: string): Promise<Delivery> {
  if (method === "local") return (await import("./local")).localDelivery;
  if (method === "dropbox") return (await import("./local")).localDelivery; // fallback to local
  if (method === "s3" || method === "azure" || method === "gcp") return (await import("./local")).localDelivery;
  if (method === "sftp" || method === "smb" || method === "api") return (await import("./local")).localDelivery;
  return (await import("./local")).localDelivery;
}
