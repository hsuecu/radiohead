import "react-native-gesture-handler";
import "react-native-reanimated";
import "react-native-get-random-values";
import { LogBox } from "react-native";
import { registerRootComponent } from "expo";
import App from "./App";
LogBox.ignoreLogs(["Expo AV has been deprecated", "Disconnected from Metro"]);
LogBox.ignoreLogs([
  'Use process(css).then(cb) to work with async plugins',
]);
console.log("loading from index.ts");

registerRootComponent(App);