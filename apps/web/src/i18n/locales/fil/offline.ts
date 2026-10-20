import type { Dictionary } from "../../translate";

export const offline: Dictionary["offline"] = {
  title: "Offline ka.",
  message: "Makikita mo pa rin ang mga pahinang nabuksan mo na. Naka-save sa device ang mga benta at ipapadala kapag online ka na; naka-pause ang iba pang pagbabago.",
  backOnline: "Online ka na ulit. Ina-refresh ang data mo.",
  unavailableTitle: "Hindi available offline ang pahinang ito",
  unavailableHint: "Kailangan nito ng data na hindi pa nailo-load sa device na ito. Buksan ito nang isang beses habang online at makikita mo na ito sa susunod.",
  receiptUnavailable: "Hindi pa nabubuksan ang receipt na ito sa device na ito, kaya hindi ito available offline.",
  cannotSave: "Offline ka, kaya hindi na-save ang pagbabagong ito. Subukan muli kapag online ka na.",
};
