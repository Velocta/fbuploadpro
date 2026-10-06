/**
 * Generates a balanced set of posting times across a day with a minimum gap.
 * @param postCount Number of posts to generate (1-5)
 * @returns Array of HH:mm strings
 */
export function generateBalancedPostTimes(postCount: number): string[] {
  if (!postCount || postCount < 1) return [];

  const MIN_GAP = 300; // 5 hours in minutes
  const DAY_START = 4; // 00:04 in minutes
  const DAY_END = 1439; // 23:59 in minutes

  const postTimes: number[] = [];
  const totalMinutes = DAY_END - DAY_START;
  const totalMinGap = MIN_GAP * (postCount - 1);
  const remainingSlack = totalMinutes - totalMinGap;
  
  // Calculate slot extra based on slack
  const slotExtra = postCount > 1 ? Math.floor(remainingSlack / postCount) : remainingSlack;

  let currentTime = DAY_START;

  for (let i = 0; i < postCount; i++) {
    const buffer = Math.floor(Math.random() * (slotExtra + 1));
    let postTime = currentTime + buffer;

    // Clamp the last post to DAY_END
    if (i === postCount - 1 && postTime > DAY_END) {
      postTime = DAY_END;
    }

    postTimes.push(postTime);
    currentTime = postTime + MIN_GAP;
  }

  // Convert minutes to HH:MM (24-hour format)
  return postTimes.map(totalMins => {
    const hours = Math.floor(totalMins / 60).toString().padStart(2, "0");
    const minutes = (totalMins % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  });
}
