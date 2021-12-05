const INITIAL_FOLLOWS = [
  { type: "youtube", channel: "LofiGirl" },
  { type: "youtube", channel: "cdawgva" },
  { type: "twitch", channel: "mukluk" },
  { type: "twitch", channel: "ironmouse" },
  { type: "twitch", channel: "cdawgva" },
];

async function getLiveInfo() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      "follows",
      async ({ follows = INITIAL_FOLLOWS }) => {
        console.info("follows", follows);
        const params = new URLSearchParams();
        const youtube = follows
          .filter(({ type }) => type === "youtube")
          .map((i) => i.channel)
          .join(",");
        const twitch = follows
          .filter(({ type }) => type === "twitch")
          .map((i) => i.channel)
          .join(",");
        if (youtube.length) params.append("youtube", youtube);
        if (twitch.length) params.append("twitch", twitch);
        const result = await fetch(
          `https://discord-slash-commands.vercel.app/api/live?${params.toString()}`
        )
          .then(async (r) => {
            if (r.ok) {
              const { result: data } = await r.json();
              return data;
            } else {
              console.error("[error]", r.status, r.statusText, await r.text());
              return [];
            }
          })
          .catch((e) => console.error("[error]", e));
        return resolve(result);
      }
    );
  });
}

async function getInfo() {
  const [liveInfo, existingInfo] = await Promise.all([
    getLiveInfo(),
    chrome.storage.sync.get("liveInfo"),
  ]);
  const { liveInfo: existing = [] } = existingInfo;
  const gotLive = liveInfo.filter((i) => i.isLive);
  const existingLive = existing.filter((i) => i.isLive);
  gotLive
    .filter(
      (g) =>
        !existingLive.some((e) => e.channel === g.channel && e.type === g.type)
    )
    .forEach((g) => {
      chrome.notifications.create({
        title: `${g.channel} is going live!`,
        type: "basic",
        message: "Channel going live now!",
        iconUrl: "/images/get_started16.png",
      });
    });
  console.info("[received]", { liveInfo });
  chrome.storage.sync.set({ liveInfo });
  chrome.runtime.sendMessage({ liveInfo });
}

chrome.runtime.onInstalled.addListener(async () => {
  const existingFollows = await chrome.storage.sync.get("follows");
  console.info("[existing:follows]", existingFollows);
  if (!existingFollows) {
    await chrome.storage.sync.set({ follows: INITIAL_FOLLOWS });
    console.info("[set:follows]", INITIAL_FOLLOWS);
  }
  await chrome.storage.sync.set({ liveInfo: [] });
  chrome.alarms.create("live-info", { delayInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "live-info") return;
    await getInfo();
  });
  await getInfo();
});
