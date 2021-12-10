const LIST_EL = document.getElementById("list");
const ADD_BTN = document.getElementById("add_btn");
const IMPORT_BTN = document.getElementById("import_btn");

syncGet("liveInfo", (liveInfo) => {
  LIST_EL.innerText = `Loading... (${(liveInfo || []).length} existing)`;
  setInfoBody(liveInfo);
});

async function addToFollows(type, channels) {
  console.info("[start:add]", type, channels);
  let existing = [];
  try {
    existing = (await asyncGet("follows")) || [];
  } catch (e) {
    console.error(e);
  }
  const follows = [
    ...new Map(
      [...existing]
        .concat(channels.map((channel) => ({ type, channel })))
        .map((i) => [`${i.type}:${i.channel}`, i])
    ).values(),
  ];
  console.info("[updated:add]", { existing, follows });
  await asyncStore("follows", follows);
  const liveInfo = await asyncGet("liveInfo");
  setInfoBody(liveInfo);
  console.info("[end:add]", type, channels);
}

async function removeFromFollows(type, channel) {
  const existing = (await asyncGet("follows")) || [];
  const follows = existing.filter(
    (e) => !(e.type === type && e.channel === channel)
  );
  await asyncStore("follows", follows);
  const liveInfo = await asyncGet("liveInfo");
  setInfoBody(liveInfo);
}

// When the button is clicked, inject getPage into current page
ADD_BTN.addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { url } = tab;
  console.info("[click:add]", url);
  if (url.includes("twitch.tv")) {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/");
    const name = parts[1];
    if (name) {
      await addToFollows("twitch", [name]);
    }
  } else if (url.includes("youtube")) {
    const urlObj = new URL(url);
    const name = urlObj.searchParams.get("ab_channel");
    if (name) {
      await addToFollows("youtube", [name]);
    }
  }
});

IMPORT_BTN.addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.info("[click:import]", tab);
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: function () {
        if (window.location.href.startsWith("https://www.twitch.tv")) {
          let hasNext = true;
          do {
            const nextBtn = document.querySelector(
              '[data-test-selector="ShowMore"]'
            );
            hasNext = !!nextBtn;
            if (nextBtn) nextBtn.click();
          } while (hasNext);
          const channels = [
            ...document.querySelectorAll(
              '[data-test-selector="followed-channel"]'
            ),
          ].map((e) => e.href.replace("https://www.twitch.tv/", ""));
          return { type: "twitch", channels };
        } else if (window.location.href.includes("youtube")) {
          document.querySelectorAll("#expander-item").item(1).click();
          const subTitle = [
            ...document.querySelectorAll("#guide-section-title"),
          ].find((e) => {
            return e.innerText.toLowerCase() === "subscriptions";
          });
          try {
            const itemsEl = subTitle.parentElement.nextSibling.nextSibling;
            const channels = [...itemsEl.querySelectorAll("#endpoint")]
              .map((i) => {
                return decodeURIComponent(
                  i.href
                    .replace("https://www.youtube.com/c/", "")
                    .replace("https://www.youtube.com/user/", "")
                    .replace("https://www.youtube.com/feed/", "")
                    .replace("https://www.youtube.com/", "")
                    .trim()
                );
              })
              .filter((c) => !c.startsWith("channel/"))
              .filter(Boolean);
            return { type: "youtube", channels };
          } catch {
            alert(
              "To import, please go to Twitch or Youtube, and make sure the subscriptions list is visible on the left."
            );
          }
        } else {
          alert(
            "To import, please go to Twitch or Youtube, and make sure the subscriptions list is visible on the left."
          );
        }
      },
    },
    ([{ result }]) => {
      addToFollows(result.type, result.channels);
    }
  );
});

async function setInfoBody(liveInfo) {
  const follows = (await asyncGet("follows")) || [];
  LIST_EL.innerText = "";
  const mappedFollows = follows.map((f) => ({
    ...f,
    ...liveInfo.find((i) => i.channel === f.channel),
  }));
  mappedFollows
    .sort(({ isLive }) => (isLive ? -1 : 1))
    .forEach(({ channel, isLive, link, type }) => {
      const rowEl = document.createElement("span");
      rowEl.classList.add("row");
      const typeEl = document.createElement("span");
      typeEl.classList.add(type);
      typeEl.innerHTML = `[${type}]`;
      const channelEl = document.createElement("span");
      channelEl.style = "flex: 2;";
      channelEl.innerHTML = channel;
      const liveEl = document.createElement("span");
      liveEl.innerHTML = isLive === undefined ? "???" : isLive ? "LIVE" : "";
      channelEl.onclick = function () {
        chrome.tabs.create({ active: true, url: link });
      };
      const delEl = document.createElement("button");
      delEl.innerHTML = "Remove";
      delEl.onclick = function () {
        removeFromFollows(type, channel);
      };
      rowEl.appendChild(typeEl);
      rowEl.appendChild(channelEl);
      rowEl.appendChild(liveEl);
      rowEl.appendChild(delEl);
      LIST_EL.appendChild(rowEl);
    });
}

chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
  console.info("received message", req, sender);
  const { liveInfo } = req;
  setInfoBody(liveInfo);
});

chrome.runtime.sendMessage({ type: "request-update" });

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
      console.error("[syncGet:error]", { key }, e);
      callback(undefined);
    }
  })();
}
