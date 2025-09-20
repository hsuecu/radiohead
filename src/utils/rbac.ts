import { Role } from "../types/station";

export function canManageStations(role: Role) {
  return role === "Owner" || role === "Admin";
}
export function canEditFiles(role: Role) {
  return role === "Owner" || role === "Admin" || role === "Editor";
}
export function canShareGlobal(role: Role) {
  return role === "Owner" || role === "Admin";
}
export function canRecord(role: Role) {
  return role !== "Viewer"; // viewers cannot create new content
}
