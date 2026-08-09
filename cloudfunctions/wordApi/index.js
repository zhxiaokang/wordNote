const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

function getOpenId() {
  return cloud.getWXContext().OPENID;
}

async function ensureCollections() {
  const names = ["users", "words", "dailyStatus", "feedback"];
  for (const name of names) {
    try {
      await db.createCollection(name);
    } catch (e) {
      // already exists — fine, this mirrors quickstartFunctions' createCollection handling
    }
  }
}

async function login({ nickName, avatarUrl }) {
  const openid = getOpenId();
  const existing = await db.collection("users").where({ _openid: openid }).get();
  const data = { _openid: openid, nickName, avatarUrl, updatedAt: Date.now() };
  if (existing.data.length) {
    await db.collection("users").doc(existing.data[0]._id).update({ data });
  } else {
    data.createdAt = Date.now();
    await db.collection("users").add({ data });
  }
  return { openid };
}

// Upserts docs into `collectionName`, matched by {_openid, matchField}. Last-write-wins by
// updatedAt: an incoming doc only overwrites an existing one if it's strictly newer.
async function upsertByField(collectionName, matchField, items) {
  const openid = getOpenId();
  for (const item of items) {
    const query = { _openid: openid, [matchField]: item[matchField] };
    const existing = await db.collection(collectionName).where(query).get();
    if (existing.data.length) {
      const stored = existing.data[0];
      if (item.updatedAt > stored.updatedAt) {
        await db.collection(collectionName).doc(stored._id).update({ data: item });
      }
    } else {
      await db.collection(collectionName).add({ data: Object.assign({ _openid: openid }, item) });
    }
  }
}

async function syncPush({ words, dailyStatus }) {
  if (words && words.length) await upsertByField("words", "id", words);
  if (dailyStatus && dailyStatus.length) await upsertByField("dailyStatus", "date", dailyStatus);
  return { success: true };
}

async function syncPull({ sinceTs }) {
  const openid = getOpenId();
  const since = sinceTs || 0;
  const [wordsRes, dailyStatusRes] = await Promise.all([
    db
      .collection("words")
      .where({ _openid: openid, updatedAt: _.gt(since) })
      .get(),
    db
      .collection("dailyStatus")
      .where({ _openid: openid, updatedAt: _.gt(since) })
      .get(),
  ]);
  return { words: wordsRes.data, dailyStatus: dailyStatusRes.data };
}

async function submitFeedback({ message }) {
  const openid = getOpenId();
  await db.collection("feedback").add({
    data: {
      _openid: openid,
      message,
      createdAt: Date.now(),
      reply: null,
      repliedAt: null,
    },
  });
  return { success: true };
}

async function getFeedback() {
  const openid = getOpenId();
  const res = await db
    .collection("feedback")
    .where({ _openid: openid })
    .orderBy("createdAt", "asc")
    .get();
  return { list: res.data };
}

exports.main = async (event, context) => {
  await ensureCollections();
  switch (event.type) {
    case "login":
      return await login(event);
    case "syncPush":
      return await syncPush(event);
    case "syncPull":
      return await syncPull(event);
    case "submitFeedback":
      return await submitFeedback(event);
    case "getFeedback":
      return await getFeedback();
    default:
      return { success: false, errMsg: "unknown type: " + event.type };
  }
};
