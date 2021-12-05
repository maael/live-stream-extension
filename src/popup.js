const LIST_EL = document.getElementById("list");
const ADD_BTN = document.getElementById("add_btn");

chrome.storage.sync.get("liveInfo", ({ liveInfo }) => {
  LIST_EL.innerText = `Loading... (${(liveInfo || []).length} existing)`;
  setInfoBody(liveInfo);
});

async function addToFollows(type, channel) {
  const { follows: existing } = (await chrome.storage.sync.get("follows")) || {
    follows: [],
  };
  const follows = [...existing].concat({ type, channel });
  chrome.storage.sync.set({
    follows,
  });
  const { liveInfo } = await chrome.storage.sync.get("liveInfo");
  setInfoBody(liveInfo);
}

// When the button is clicked, inject getPage into current page
ADD_BTN.addEventListener("click", async () => {
  console.info("[click]");
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { url } = tab;
  if (url.includes("twitch.tv")) {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/");
    const name = parts[1];
    if (name) {
      addToFollows("twitch", name);
    }
  } else if (url.includes("youtube")) {
    const urlObj = new URL(url);
    const name = urlObj.searchParams.get("ab_channel");
    if (name) {
      addToFollows("youtube", name);
    }
  }
});

async function setInfoBody(liveInfo) {
  const { follows } = (await chrome.storage.sync.get("follows")) || {
    follows: [],
  };
  LIST_EL.innerText = "";
  const mappedFollows = follows.map((f) => ({
    ...f,
    ...liveInfo.find((i) => i.channel === f.channel),
  }));
  mappedFollows
    .sort(({ isLive }) => (isLive ? -1 : 1))
    .forEach(({ channel, isLive, link, type }) => {
      const a = document.createElement("a");
      a.classList.add("row");
      a.innerHTML = `<span class="${type}">[${type}]</span><span style="flex: 2;">${channel}</span><span>${
        isLive === undefined ? "???" : isLive ? "LIVE" : ""
      }</span>`;
      a.onclick = function () {
        chrome.tabs.create({ active: true, url: link });
      };
      LIST_EL.appendChild(a);
    });
}

chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
  console.info("received message", req, sender);
  const { liveInfo } = req;
  setInfoBody(liveInfo);
});

chrome.runtime.sendMessage({ type: "request-update" });
