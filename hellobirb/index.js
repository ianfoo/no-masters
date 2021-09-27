import { Client, Intents, TextChannel } from "discord.js";
import { config as dotEnvConfig } from "dotenv";
import { readFileSync } from "fs";
import { writeFile } from "fs/promises";

import pkg from "date-fns-tz";
const { utcToZonedTime } = pkg;

// TODO Make this less of a tire fire, code-wise.

// Build a time-aware greeting for the user who has just joined.
// Does not take into account the user's local time, but there
// doesn't appear to be any timezone data available for Discord
// users.
function buildGreeting(user, channel, now) {
  console.log(channel);
  console.log(channel.members);
  const hour = now.getHours();
  const isLateNight = hour < 5;
  const isMorning = hour >= 5 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 17;

  const mention = user.toString();
  let greeting;
  if (isLateNight) {
    greeting = `You're burning the midnight oil, ${mention}!`;
  } else if (isMorning) {
    greeting = `Good morning, ${mention}!`;
  } else if (isAfternoon) {
    greeting = `Good afternoon, ${mention}!`;
  } else {
    greeting = `Good evening, ${mention}!`;
  }
  if (now.getDay() === 1 && isMorning && mondayMorningAddendum) {
    greeting += mondayMorningAddendum;
  }
  const richMsg = {
    content: greeting,
    embeds: [{ thumbnail: { url: "attachment://static/birb.jpg" } }],
  };
  if (channel.members.size === 1) {
    richMsg.embeds[0].footer = "You're the first one here.";
  }
  return greeting;
}

function initClient(
  watchChannelId,
  announceChannelId,
  mondayMorningAddendum,
  botTimeZone
) {
  console.log(
    `initializing bot: watching channel ${watchChannelId} and announcing on ${announceChannelId}`
  );
  const lastSeenDBFileName = "last-seen.json";
  let lastSeenDB = {};
  try {
    lastSeenDB = JSON.parse(readFileSync(lastSeenDBFileName));
  } catch (ex) {
    console.error(`unable to read file of last-seen records: ${ex}`);
  }

  // Create a new client instance.
  const botIntents = new Intents();
  botIntents.add(Intents.FLAGS.GUILD_VOICE_STATES);
  const client = new Client({ intents: botIntents });

  // Announce (locally) when the bot is ready.
  client.once("ready", () => {
    console.log("Cheep cheep! I'm ready to greet!");
  });

  // Watch for users turning on their cameras in a voice channel.
  client.on("voiceStateUpdate", (oldState, newState) => {
    const connected =
      !oldState.selfVideo &&
      newState.selfVideo &&
      newState.channelId === watchChannelId;
    if (!connected) return;

    console.log(lastSeenDB);
    const memberId = newState.member.id;
    const lastSeenUTC = lastSeenDB[memberId];
    const now = new Date();

    // Update last seen entry for this guild member.
    lastSeenDB[memberId] = now;
    writeFile(lastSeenDBFileName, JSON.stringify(lastSeenDB))
      .then(() =>
        console.log(
          `updated last seen database for guild member ID ${memberId}`
        )
      )
      .catch((err) =>
        console.error(
          `unable to update last seen database for guild member ID ${memberId}: ${err}`
        )
      );

    // Make sure we haven't already greeted this guild member today.
    if (lastSeenUTC) {
      const lastSeenLocal = utcToZonedTime(lastSeenUTC, botTimeZone);
      const nowLocal = utcToZonedTime(now, botTimeZone);
      if (lastSeenLocal.getDay() == nowLocal.getDay()) {
        // Don't greet more than once a day.
        console.log(`refusing to greet ${memberId} more than once today`);
        return;
      }
    }

    newState.client.channels.fetch(announceChannelId).then((chan) => {
      if (!chan.isText()) {
        console.error(
          `expected channel ${announceChannelId} to be a text channel`
        );
        return;
      }

      const now = utcToZonedTime(new Date(), botTimeZone);
      console.log(newState.channelId);
      const greeting = buildGreeting(
        newState.member.user,
        newState.channel,
        now,
        mondayMorningAddendum
      );

      // Wait a few seconds to make the interaction feel a bit more "natural,"
      // then send the greeting.
      setTimeout(() => chan.send(greeting), 3000);
    });
    //   .catch((err) => {
    //     console.error(
    //       `error getting announcement channel ${announceChannelId}: ${err}`
    //     );
    //   });
  });
  return client;
}

// Read config and init client.
dotEnvConfig();
const token = process.env.BOT_TOKEN;
const watchChannelId = process.env.WATCH_VOICE_CHANNEL_ID;
const announceChannelId = process.env.ANNOUNCE_CHANNEL_ID;
const mondayMorningAddendum = process.env.MONDAY_MORNING_ADDENDUM;
const botTimeZone = process.env.BOT_TIME_ZONE;

console.log(`watch chan: ${watchChannelId} announce: ${announceChannelId}`);
const client = initClient(
  watchChannelId,
  announceChannelId,
  mondayMorningAddendum,
  botTimeZone
);

// Start the bot!
client.login(token);
