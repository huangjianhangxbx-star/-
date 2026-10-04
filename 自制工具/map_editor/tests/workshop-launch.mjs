import { _electron as electron } from "playwright";
export function launchWorkshop() {
  return electron.launch({
    args: [".", "--workspace=workshop", "--test-hidden"],
    executablePath: "node_modules/electron/dist/electron.exe",
  });
}
