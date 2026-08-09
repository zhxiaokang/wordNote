// review.js — spaced-repetition schedule, simplified Ebbinghaus-inspired intervals (in days).
const { addDays } = require('./date.js');

const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30];

// Given a word's current stage and whether it was just answered correctly, return the
// next { stage, nextReviewDate } computed from fromDate (normally today).
function advanceSchedule(stage, correct, fromDate) {
  let nextStage;
  if (correct) {
    nextStage = Math.min(stage + 1, REVIEW_INTERVALS.length - 1);
  } else {
    nextStage = 0;
  }
  const interval = REVIEW_INTERVALS[nextStage];
  return {
    stage: nextStage,
    nextReviewDate: addDays(fromDate, interval),
  };
}

module.exports = {
  REVIEW_INTERVALS,
  advanceSchedule,
};
