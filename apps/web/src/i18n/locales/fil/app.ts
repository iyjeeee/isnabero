import type { Dictionary } from "../../translate";

export const app: Dictionary["app"] = {
  routeGuard: {
    noAccessTitle: "Wala kang access sa pahinang ito",
    noAccessHint: "Hindi kasama ito sa tungkulin mo. Magtanong sa owner o admin kung kailangan mo ito.",
    backToDashboard: "Bumalik sa Dashboard",
    thisModule: "Ang module na ito",
    moduleOffTitle: "Naka-off ang {module}",
    moduleOffHint: "Hindi ito naka-enable sa negosyong ito.",
    openSetup: "Buksan ang Pag-setup ng Negosyo",
  },
  errorBoundary: { unexpected: "May hindi inaasahang error." },
};
