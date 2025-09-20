import * as FileSystem from "expo-file-system";
import { Delivery, PutArgs } from ".";

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true });
}

export const localDelivery: Delivery = {
  async put(a: PutArgs) {
    const { path, uri, bytes } = a;
    const dir = path.substring(0, path.lastIndexOf("/"));
    await ensureDir(dir);
    const tmp = `${path}.tmp`;
    if (uri) {
      await FileSystem.copyAsync({ from: uri, to: tmp });
    } else if (bytes) {
      await FileSystem.writeAsStringAsync(tmp, Buffer.from(bytes as any).toString("base64"), { encoding: FileSystem.EncodingType.Base64 });
    } else {
      throw new Error("Nothing to upload");
    }
    await FileSystem.moveAsync({ from: tmp, to: path });
  },
  async rename(from: string, to: string) {
    const dir = to.substring(0, to.lastIndexOf("/"));
    await ensureDir(dir);
    await FileSystem.moveAsync({ from, to });
  },
  async verify(path: string) {
    const info = await FileSystem.getInfoAsync(path);
    return !!info.exists && info.size != null && info.size > 0;
  },
};
