const INITIAL_FOLLOWS = [
  { type: "youtube", channel: "LofiGirl" },
  { type: "youtube", channel: "cdawgva" },
  { type: "twitch", channel: "mukluk" },
  { type: "twitch", channel: "ironmouse" },
  { type: "twitch", channel: "cdawgva" },
];

async function getLiveInfo() {
  return new Promise((resolve) => {
    syncGet("follows", async (follows = INITIAL_FOLLOWS) => {
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
      const url = `https://discord-slash-commands.vercel.app/api/live?${params.toString()}`;
      console.info(
        "[liveInfo]",
        `https://discord-slash-commands.vercel.app/api/live?${params.toString()}`
      );
      const result = await fetch(url)
        .then(async (r) => {
          if (r.ok) {
            const { result: data } = await r.json();
            return data;
          } else {
            console.warn("[error]", r.status, r.statusText, await r.text());
            return [];
          }
        })
        .catch((e) => console.error("[error]", e));
      return resolve(result);
    });
  });
}

chrome.notifications.onClicked.addListener(function (notificationId) {
  if (notificationId.includes("https://")) {
    chrome.tabs.create({ active: true, url: notificationId });
  }
});

async function getInfo() {
  const [liveInfo, existingInfo] = await Promise.all([
    getLiveInfo(),
    asyncGet("liveInfo"),
  ]);
  const existing = existingInfo || [];
  const gotLive = liveInfo.filter((i) => i.isLive);
  const existingLive = existing.filter((i) => i.isLive);
  const notifications = gotLive.filter(
    (g) =>
      !existingLive.some((e) => e.channel === g.channel && e.type === g.type)
  );

  if (notifications.length < 4) {
    notifications.forEach((g) => {
      chrome.notifications.create(g.link, {
        title: `${g.channel} is going live!`,
        type: "basic",
        message: "Channel going live now!",
        iconUrl: "/images/get_started16.png",
      });
    });
  } else {
    chrome.notifications.create({
      title: `${notifications.length} channels going live!`,
      type: "basic",
      message: "Channels going live now!",
      iconUrl: "/images/get_started16.png",
    });
  }
  console.info("[received]", { liveInfo });
  asyncStore("liveInfo", liveInfo);
  chrome.runtime.sendMessage({ liveInfo });
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.info("[message]", message);
  if (message.type === "request-update") {
    await getInfo();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.info("[alarm]", alarm.name);
  if (alarm.name !== "live-info") return;
  await getInfo();
});

chrome.runtime.onInstalled.addListener(async () => {
  const existingFollows = await asyncGet("follows");
  console.info("[existing:follows]", existingFollows);
  if (!existingFollows) {
    await asyncStore("follows", INITIAL_FOLLOWS);
    console.info("[set:follows]", INITIAL_FOLLOWS);
  }
  await asyncStore("liveInfo", []);
  const existingAlarm = await chrome.alarms.get("live-info");
  if (!existingAlarm) {
    chrome.alarms.create("live-info", { delayInMinutes: 1 });
  }
  await getInfo();
});

function asyncStore(key, objectToStore) {
  return new Promise((resolve) => syncStore(key, objectToStore, resolve));
}

function asyncGet(key) {
  return new Promise((resolve) => syncGet(key, resolve));
}

function syncStore(key, objectToStore, callback) {
  const jsonstr = JSON.stringify(objectToStore);
  const storageObj = {};
  const blockSize =
    chrome.storage.sync.QUOTA_BYTES_PER_ITEM / 2 - (4 + key.length);
  const numberOfBlocks = Math.ceil(jsonstr.length / blockSize);
  console.info("[syncStore:start]", {
    key,
    numberOfBlocks,
    blockSize,
    itemSize: jsonstr.length,
  });

  for (let i = 0; i < numberOfBlocks; i++) {
    const partialKey = `${key}_${i}`;
    const block = jsonstr.substr(i * blockSize, blockSize);
    console.info("[syncStore:partial]", {
      partialKey,
      i,
      start: i * blockSize,
      blockSize,
      block,
    });
    storageObj[partialKey] = block;
  }

  console.info("[syncStore:set]", storageObj);
  chrome.storage.sync.set(storageObj, callback);
}

function syncGet(key, callback) {
  (async () => {
    try {
      let i = 0;
      let foundData;
      while (true) {
        let partialKey = `${key}_${i}`;
        const found = await chrome.storage.sync.get(partialKey);
        const data = found[partialKey];
        console.info("[syncGet:partial]", { key: partialKey, data });
        if (!data) {
          break;
        } else {
          foundData = (foundData || "") + data;
        }
        i++;
      }
      console.info("[syncGet:get]", { key, foundData });
      callback(foundData !== undefined ? JSON.parse(foundData) : foundData);
    } catch (e) {
      console.warn("[syncGet:error]", key, e);
      callback(undefined);
    }
  })();
}
