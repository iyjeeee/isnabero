import type { Dictionary } from "../../translate";

export const offlineSales: Dictionary["offlineSales"] = {
  savedOffline: "Naka-save sa device na ito — ipapadala kapag online ka na ulit.",
  synced: "1 offline na benta ang naipadala.|{count} offline na benta ang naipadala.",
  refused: "1 offline na benta ang tinanggihan. Buksan ang Suriin para magdesisyon.|{count} offline na benta ang tinanggihan. Buksan ang Suriin para magdesisyon.",
  bar: {
    waiting: "1 benta ang naghihintay maipadala|{count} benta ang naghihintay maipadala",
    failed: "1 ang kailangang tingnan|{count} ang kailangang tingnan",
    review: "Suriin",
  },
  dialog: {
    title: "Mga benta na naghihintay maipadala",
    descriptionOnline: "Ginawa ang mga ito nang walang koneksyon. Ipinapadala ang mga ito ayon sa pagkakasunod-sunod ng nangyari.",
    descriptionOffline: "Naka-save ang mga ito sa device na ito at ipapadala agad kapag online ka na ulit.",
    retry: "Subukan muli",
    discard: "Itapon",
  },
  status: { waiting: "Naghihintay", failed: "Tinanggihan" },
};
