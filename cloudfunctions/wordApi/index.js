const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

function getOpenId() {
  return cloud.getWXContext().OPENID;
}

async function ensureCollections() {
  try {
    await db.createCollection("feedback");
  } catch (e) {
    // already exists — fine, this mirrors quickstartFunctions' createCollection handling
  }
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
    case "submitFeedback":
      return await submitFeedback(event);
    case "getFeedback":
      return await getFeedback();
    default:
      return { success: false, errMsg: "unknown type: " + event.type };
  }
};
