import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    // @ts-expect-error dynamic
    navigationRef.navigate(name as never, params as never);
  }
}

export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}
