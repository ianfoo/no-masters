import { Client, Intents } from "discord.js";
import { config as dotEnvConfig } from "dotenv";
import { readFileSync } from "fs";
import { writeFile } from "fs/promises";
import * as http from "http";

import pkg from "date-fns-tz";
const { utcToZonedTime } = pkg;

const greetingDelayMs = 3000;
const lastSeenDBFileName = "last-seen.json";

// TODO
// * Make this a bit more sane, code-wise.
// * SQLite last-seen database?

// Build a time-aware greeting for the user who has just joined.
// Does not take into account the user's local time, but there
// doesn't appear to be any timezone data available for Discord
// users.
function buildGreeting(user, channel, now, mondayMorningAddendum) {
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
    greeting += " " + mondayMorningAddendum;
  }
  if (channel.members.size === 1) {
    greeting += " You're the first one here.";
  }
  return greeting;
}

// Load the last-seen database, which is currently a janky JSON
// file. This is fine for low volume usage, though, and simpler
// than trying to connect with an actual database.
function loadLastSeenDB() {
  let lastSeenDB = {};
  try {
    lastSeenDB = JSON.parse(readFileSync(lastSeenDBFileName));
  } catch (ex) {
    console.error(`unable to read file of last-seen records: ${ex}`);
  } finally {
    return lastSeenDB;
  }
}

// Update last seen entry for this guild member. Will still return
// an in-memory database even if the database cannot be persisted.
function updateLastSeenDB(lastSeenDB, guildMemberId, now) {
  lastSeenDB[guildMemberId] = now;
  writeFile(lastSeenDBFileName, JSON.stringify(lastSeenDB))
    .then(() =>
      console.log(
        `updated last seen database for guild member ID ${guildMemberId}`
      )
    )
    .catch((err) =>
      console.error(
        `unable to update last seen database for guild member ID ${guildMemberId}: ${err}`
      )
    );
  return lastSeenDB;
}

// Make a greeter to greet users in the annoucment channel when they show up in
// the watched voice channel with their camera on, and haven't been seen yet
// today.
function makeGreeter(config, lastSeenDB) {
  const {
    watchChannelId,
    announceChannelId,
    mondayMorningAddendum,
    botTimeZone,
    devMode,
  } = config;

  const greeter = (oldState, newState) => {
    const connected =
      newState.selfVideo &&
      newState.channelId === watchChannelId &&
      (!oldState.selfVideo || oldState.channelId !== watchChannelId);
    if (!connected) return;

    const memberId = newState.member.id;
    const lastSeenUTC = lastSeenDB[memberId];
    const now = new Date();
    updateLastSeenDB(lastSeenDB, memberId, now);

    // Make sure we haven't already greeted this guild member today. Don't do
    // this check if we're in dev mode, to make testing easier.
    if (lastSeenUTC && !devMode) {
      const lastSeenLocal = utcToZonedTime(lastSeenUTC, botTimeZone);
      const nowLocal = utcToZonedTime(now, botTimeZone);
      if (lastSeenLocal.getDay() == nowLocal.getDay()) {
        console.log(`refusing to greet ${memberId} more than once today`);
        return;
      }
    }

    newState.client.channels
      .fetch(announceChannelId)
      .then((chan) => {
        if (!chan.isText()) {
          console.error(
            `expected channel ${announceChannelId} to be a text channel`
          );
          return;
        }

        const now = utcToZonedTime(new Date(), botTimeZone);
        const greeting = buildGreeting(
          newState.member.user,
          newState.channel,
          now,
          mondayMorningAddendum
        );

        // Wait a few seconds to make the interaction feel a bit more "natural,"
        // then send the greeting.
        setTimeout(() => chan.send(greeting), 3000);
      })
      .catch((err) => {
        console.error(
          `error fetching announcement channel ${announceChannelId}: ${err}`
        );
      });
  };

  return greeter;
}

// Initialize the client to handle the events we care about.
// At this point, just voice state changes.
function initClient(config) {
  console.log(config);

  // Create a new client instance.
  const botIntents = new Intents();
  botIntents.add(Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES);
  const client = new Client({ intents: botIntents });

  // Announce (locally) when the bot is ready.
  client.once("ready", () => {
    console.log("Cheep cheep! I'm ready to greet!");
  });

  // Watch for users turning on their cameras in a voice channel.
  const lastSeenDB = loadLastSeenDB();
  const greeter = makeGreeter(config, lastSeenDB);
  client.on("voiceStateUpdate", greeter);

  return client;
}

console.log("starting up!");

// Read config and init client.
dotEnvConfig();
const config = {
  watchChannelId: process.env.WATCH_VOICE_CHANNEL_ID,
  announceChannelId: process.env.ANNOUNCE_CHANNEL_ID,
  botTimeZone: process.env.BOT_TIME_ZONE,
  mondayMorningAddendum: process.env.MONDAY_MORNING_ADDENDUM,
  devMode: Boolean(process.env.DEV_MODE),
};
const client = initClient(config);

// Start our ping/healthcheck endpoint.
http
  .createServer((req, res) => {
    res.write("hellobirb bot is running!");
    res.end();
  })
  .listen(process.env.PORT || 8080);

// Start the bot!
const token = process.env.BOT_TOKEN;
client.login(token);
