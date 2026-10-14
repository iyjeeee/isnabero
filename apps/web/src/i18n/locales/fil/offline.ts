import type { Dictionary } from "../../translate";

export const offline: Dictionary["offline"] = {
  title: "Offline ka.",
  message: "Makikita mo pa rin ang mga pahinang nabuksan mo na. Naka-pause ang pagbebenta, pag-save at iba pang pagbabago hanggang maka-online ka ulit.",
  backOnline: "Online ka na ulit. Ina-refresh ang data mo.",
  unavailableTitle: "Hindi available offline ang pahinang ito",
  unavailableHint: "Kailangan nito ng data na hindi pa nailo-load sa device na ito. Buksan ito nang isang beses habang online at makikita mo na ito sa susunod.",
  receiptUnavailable: "Hindi pa nabubuksan ang receipt na ito sa device na ito, kaya hindi ito available offline.",
  cannotSave: "Offline ka, kaya hindi na-save ang pagbabagong ito. Subukan muli kapag online ka na.",
};
