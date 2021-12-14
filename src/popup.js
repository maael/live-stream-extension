const LIST_EL = document.getElementById("list");
const ADD_BTN = document.getElementById("add_btn");
const IMPORT_BTN = document.getElementById("import_btn");
const REFRESH_BTN = document.getElementById("import_btn");

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

REFRESH_BTN.addEventListener("click", async () => {
  chrome.runtime.sendMessage({ type: "request-update" });
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

function getLiveItemHTML(data) {
  return `
  <div>
    <div class="live-thumb-container">
      <img class="live-thumb" src=${data.thumbnail} />
      <small class="live-views">${data.viewCount.replace(
        "watching",
        `<svg xmlns="http://www.w3.org/2000/svg" style="width:1em;height:1em;" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
    </svg>`
      )}</small>
    </div>
    <h5 class="live-title">${[data.game, data.title]
      .filter(Boolean)
      .join(" - ")}
    </h5>
    </div>
  `;
}

const YOUTUBE_ICON = `<svg version="1.1" style="height:2em;width:2em;" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
viewBox="0 0 461.001 461.001" style="enable-background:new 0 0 461.001 461.001;" xml:space="preserve">
<g>
<path style="fill:#F61C0D;" d="M365.257,67.393H95.744C42.866,67.393,0,110.259,0,163.137v134.728
 c0,52.878,42.866,95.744,95.744,95.744h269.513c52.878,0,95.744-42.866,95.744-95.744V163.137
 C461.001,110.259,418.135,67.393,365.257,67.393z M300.506,237.056l-126.06,60.123c-3.359,1.602-7.239-0.847-7.239-4.568V168.607
 c0-3.774,3.982-6.22,7.348-4.514l126.06,63.881C304.363,229.873,304.298,235.248,300.506,237.056z"/></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>`;

const TWITCH_ICON = `<svg style="height:2em;width:2em;" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
<circle cx="512" cy="512" r="512" style="fill:#9146ff"/>
<path d="M692.9 535 617 607h-76l-66.5 63v-63H389V337.2h303.9V535zM370 301.2l-95 89.9v323.8h114v89.9l95-89.9h76L730.9 553V301.2H370zM636 403h-38v107.9h38V403zm-142.5-.5h38v107.9h-38V402.5z" style="fill:#fff"/>
</svg>`;

async function setInfoBody(liveInfo) {
  const follows = (await asyncGet("follows")) || [];
  LIST_EL.innerText = "";
  const mappedFollows = follows.map((f) => ({
    ...f,
    ...liveInfo.find((i) => i.channel === decodeURIComponent(f.channel)),
    channel: decodeURIComponent(f.channel),
  }));
  mappedFollows
    .filter(({ channel }) => !!channel)
    .sort(({ data: a }, { data: b }) => {
      return (
        (parseInt(b?.viewCount.split(" ")[0].replace(",", "")) || 0) -
        (parseInt(a?.viewCount.split(" ")[0].replace(",", "")) || 0)
      );
    })
    .forEach(({ channel, isLive, link, type, data }) => {
      const itemEl = document.createElement("span");
      itemEl.classList.add("item", type);
      const rowEl = document.createElement("span");
      rowEl.classList.add("row");
      const typeEl = document.createElement("span");
      typeEl.classList.add(type);
      typeEl.innerHTML = type === "youtube" ? YOUTUBE_ICON : TWITCH_ICON;
      typeEl.style = "flex: 0;margin-right:0.2em;";
      const channelEl = document.createElement("span");
      channelEl.classList.add("channel");
      channelEl.innerHTML = channel;
      const liveEl = document.createElement("span");
      liveEl.innerHTML =
        isLive === undefined
          ? "???"
          : isLive
          ? `<svg xmlns="http://www.w3.org/2000/svg" style="width:2em;height:2em;color:green;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>`
          : "";
      itemEl.onclick = function (e) {
        if (e.target.classList.contains("rm")) {
          removeFromFollows(type, channel);
        } else {
          chrome.tabs.create({
            active: true,
            url: data ? data.url || link : link,
          });
        }
      };
      const delEl = document.createElement("button");
      delEl.classList.add("rm-btn", "rm");
      delEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="rm" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
    </svg>`;
      rowEl.appendChild(typeEl);
      rowEl.appendChild(channelEl);
      rowEl.appendChild(liveEl);
      rowEl.appendChild(delEl);
      itemEl.appendChild(rowEl);
      if (data) {
        itemEl.innerHTML += getLiveItemHTML(data);
      }
      LIST_EL.appendChild(itemEl);
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
