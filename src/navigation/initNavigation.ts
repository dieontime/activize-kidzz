import { init } from "@noriginmedia/norigin-spatial-navigation";

let started = false;

export function initNavigation(): void {
  if (started) return;
  init({ debug: false, visualDebug: false });
  started = true;
}
