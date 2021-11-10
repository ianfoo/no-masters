import { Client, Intents } from 'discord.js';
import { config as dotEnvConfig } from 'dotenv';
import { readFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import {
  differenceInDays,
  differenceInHours,
  isMonday,
  isFirstDayOfMonth,
  isFriday,
  isSameDay,
  isToday,
} from 'date-fns';
import tzPkg from 'date-fns-tz';
import * as http from 'http';
import getWeatherForecast from './lib/weather.js';

const { utcToZonedTime } = tzPkg;

const greetingDelayMs = 3000;
const lastSeenDBFileName = 'last-seen.json';

// TODO
// * Make this a bit more sane, code-wise. Split into a couple files.
// * SQLite last-seen database?
//   * It's not just for last-seen data, or won't be for long, so, rename.
// * Handle multiple servers.
// * Reply/react to mentions and reactions on sent messages.
// * Validation of configuration (e.g., non-empty channel IDs).
// * Custom greetings/greeting fragments for specially-configured users.
// * Add Guild IDs since member IDs are the same as user IDs.
// * Read/write from files not located in run directory (e.g., XDG_DATA_HOME).

// TODO Incorporate Monday Morning Addendum into the date-based greeting.
function buildDateGreeting(now) {
  // Is it Friday yet?!
  const todayIsFriday = isFriday(now);
  const isLateEvening = now.getHours() >= 20;

  // Is it a new month?
  const todayIsTheFirst = isFirstDayOfMonth(now);

  if (!todayIsFriday && !todayIsTheFirst) {
    return '';
  }

  let dateGreeting = ' ';
  if (todayIsFriday && !isLateEvening) {
    dateGreeting += 'Happy Friday';
  }
  if (todayIsTheFirst) {
    if (dateGreeting.length > 0) {
      dateGreeting += ', and happy ';
    } else {
      dateGreeting += 'Happy ';
    }
    const month = now.toLocaleString('en-US', { month: 'long' });
    dateGreeting += month;
  }
  dateGreeting += '! :partying_face:';
  return dateGreeting;
}

async function buildWeatherMessage(location) {
  if (!location) {
    console.log('No location specified for weather: skipping');
    return '';
  }
  let weather;
  try {
    console.log(`Getting weather for ${location}`);
    weather = await getWeatherForecast(location);
  } catch (ex) {
    console.error(`weather: ${ex}`);
    return '';
  }
  const forecast = `${weather.forecast[0].toLowerCase()}${weather.forecast.substring(
    1,
  )}`;
  return weather
    ? `The forecast for ${weather.for} is ${forecast}`
    : '';
}

function getWeekendPromptIfMonday(
  now,
  mondayMorningAddendum,
  isMorning,
) {
  // TODO Be smarter about case when first day of work week is not Monday,
  // in the event of holidays.
  if (!isMonday(now)) {
    return '';
  }
  let greeting = '';
  if (isMorning && mondayMorningAddendum) {
    greeting = `${mondayMorningAddendum} `;
  }
  const prompts = [
    'How was your weekend?',
    'How was your weekend?',
    'I hope you had a good weekend! Did you get into anything fun?',
    'I spent all weekend flying around, and boy are my wings tired. How about you?',
    'I need a weekend after that weekend. Are you ready for the week?',
    "What's the best thing you ate this weekend?",
    'Did you watch anything good this weekend?',
    'Did you do anything cool this weekend?',
    "Did you also get into a fight where you smashed a pool cue over someone's head this weekend, or was that just me?",
    'Did you steal any cars this weekend?',
    'Were you involved in a high speed chase this weekend?',
    'Did you win any street races this weekend?',
  ];
  const n = Math.floor(Math.random() * prompts.length);
  greeting += prompts[n];
  return greeting;
}

// Build a time-aware greeting for the user who has just joined.
// Does not take into account the user's local time, but there
// doesn't appear to be any timezone data available for Discord
// users.
async function buildGreeting(
  member,
  channel,
  now,
  lastSeen,
  latestGreetingTime,
  {
    weatherLocation,
    mondayMorningAddendum,
    giftProbability,
    extraGiftProbability,
    goodToSeeYouDays,
    alwaysGreet,
    alwaysFirst,
    alwaysWeather,
  },
) {
  const hour = now.getHours();
  const isLateNight = hour < 5;
  const isMorning = hour >= 5 && hour < 12;
  const isEarlyMorning = hour >= 5 && hour < 8;
  const isAfternoon = hour >= 12 && hour < 17;
  const isEarlyEvening = hour >= 17 && hour < 20;

  let greeting = ':bird: ';
  if (isLateNight) {
    greeting += `You're burning the midnight oil, ${member}! :crescent_moon:`;
  } else if (isMorning) {
    greeting += `Good morning, ${member}! `;
    greeting += isEarlyMorning
      ? ':sunrise_over_mountains:'
      : ':white_sun_cloud:';
  } else if (isAfternoon) {
    greeting += `Good afternoon, ${member}! :sun_with_face:`;
  } else {
    greeting += `Good evening, ${member}! `;
    greeting += isEarlyEvening ? ':city_dusk:' : ':night_with_stars:';
  }

  greeting += buildDateGreeting(now);

  // Try to figure out how long it's been since we last saw this user. If we
  // have no record of last seen, introduce ourselves.
  if (lastSeen) {
    const daysSinceLastSeen = differenceInDays(now, lastSeen);
    const beenAMinute = daysSinceLastSeen >= goodToSeeYouDays;
    if (beenAMinute) {
      console.log(
        `${member.id} has popped in for the first time in ${daysSinceLastSeen} days`,
      );
      greeting += " It's good to see you again!";

      const beenALongTime = daysSinceLastSeen >= 2 * goodToSeeYouDays;
      if (beenALongTime) {
        greeting += " I've missed you!";
      }
      greeting += ' :relaxed:';
    }
  } else {
    greeting +=
      " I think I'm new since you were last here. It's so nice to meet you! :hugging:";
  }

  if (differenceInDays(now, latestGreetingTime) >= 2) {
    greeting += ' I sure am glad to have someone to talk to again!';
  }

  // Because we only get here if the user has either just enabled video or just
  // come into this channel (with video enabled, if this is even possible), we
  // can assume that the count is increasing over its previous count, so no need
  // to worry about sending encouraging Hollywood Squares messages as people are
  // leaving the channel.

  // numOnline counts members in the channel with video active.
  const numOnline = channel.members.reduce(
    (acc, m) => acc + (m.voice.selfVideo ? 1 : 0),
    0,
  );
  console.log(`members online in this channel: ${numOnline}`);

  const hollywoodSquaresThreshold = 9;
  if (numOnline <= hollywoodSquaresThreshold) {
    if (numOnline === hollywoodSquaresThreshold) {
      greeting += ` Woo! We have enough for Hollywood Squares! :movie_camera::white_square_button::raised_hands:`;
    } else if (numOnline >= hollywoodSquaresThreshold - 2) {
      const numNeeded = hollywoodSquaresThreshold - numOnline;
      greeting += ` We're so close to Hollywood Squares! Only ${numNeeded} more! :raised_hands:`;
    } else if (numOnline >= hollywoodSquaresThreshold / 2) {
      greeting += ` We've got ${numOnline} here and are over halfway to Hollywood Squares!`;
    }
  }

  let motd = '';
  let onThisDay = '';

  if (!isToday(latestGreetingTime) || alwaysFirst) {
    if (numOnline === 1 || alwaysFirst) {
      greeting += " You're the first one here. ";
      const awardPool = [':first_place:', ':trophy:'];
      const n = Math.floor(Math.random() * awardPool.length);
      const award = awardPool[n];
      greeting += award;
    }

    // Add message of the day, if it exists.
    //
    // TODO Store in a database or something better than a text file.
    try {
      const motdFile = 'motd.txt';
      if (existsSync(motdFile)) {
        motd = readFileSync(motdFile).toString();

        // Archive previous MOTD.
        if (!alwaysGreet) {
          mkdirSync('.motd', { recursive: true });
          renameSync(motdFile, `.motd/motd.${now.toISOString()}.txt`);
        }
      }
    } catch (err) {
      console.error(`error adding motd: ${err}`);
    }

    // Look for content relating to this date. First, including the year, then
    // falling back to just the month and day.
    try {
      const onThisDayDir = 'on-this-day';
      const monthAndDay = `${String(now.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(now.getDate()).padStart(2, '0')}`;
      const yearMonthDay = `${now.getFullYear()}-${monthAndDay}`;
      const onThisDayWithYearFile = `${onThisDayDir}/${yearMonthDay}.txt`;
      const onThisDayWithoutYearFile = `${onThisDayDir}/${monthAndDay}.txt`;

      if (existsSync(onThisDayWithYearFile)) {
        onThisDay = readFileSync(onThisDayWithYearFile).toString();
      } else if (existsSync(onThisDayWithoutYearFile)) {
        onThisDay = readFileSync(onThisDayWithoutYearFile).toString();
      }
    } catch (err) {
      console.error(`error adding "on this day" content: ${err}`);
    }
  }

  // Maybe present a gift to the arriving user.
  // TODO Make this bonus adjustable per user.
  const userBonus = 0;
  const shouldGift =
    Math.floor(Math.random() * 100) >=
    100 - (giftProbability + userBonus);
  if (shouldGift) {
    // Maybe give multiple gifts.
    let giftCount = 1;
    let joiningText = ' I brought you';
    const extraGift = Math.floor(Math.random() * 100);
    if (extraGift >= 100 - extraGiftProbability) {
      giftCount += 1;
    }
    const gifts = [
      'a flower! :sunflower:',
      'a flower! :rose:',
      'some flowers! :bouquet:',
      'a cactus! :cactus:',
      'a shell! :shell:',
      'a ball of yarn! :yarn:',
      'a roll of toilet paper! :roll_of_paper:',
      'this book I really like! :closed_book:',
      "today's newspaper! :newspaper:",
      'a poem I wrote! :scroll:',
      'this letter I wrote to you! :envelope:',
      'a new playlist I made! :notes:',
      'some chocolate! :chocolate_bar:',
      'a cookie! :cookie:',
      'a doughnut! :doughnut:',
      'a croissant! :croissant:',
      'pancakes! :pancakes:',
      'a waffle! :waffle:',
      'a bagel! :bagel:',
      'a sandwich! :sandwich:',
      'a fresh loaf of bread I baked! :bread:',
      'an avocado! :avocado:',
      'blueberries! :blueberries:',
      'some tea! :tea:',
      'a cocktail! :cocktail:',
      'a nice tall glass of whisky :tumbler_glass:',
      'a cold beer! :beer:',
      'some classy wine! :wine_glass:',
      'a nice cup of coffee :coffee:',
      'a yerba mate! :mate:',
      'this corn! :corn:',
      'some cheese! :cheese:',
      'a burrito! :burrito:',
      'a taco! :taco:',
      'a tamale! :tamale:',
      'a burger! :hamburger:',
      'some fries! :fries:',
      'a potato! :potato:',
      'a slice of pizza! :pizza:',
      'some sushi! :sushi:',
      'some ramen! :ramen:',
      'a dumpling! :dumpling:',
      'some takeout! :takeout_box:',
      'a bed! :bed:',
      'a candle! :candle:',
      'a dagger! :dagger:',
      'a spoon! :spoon:',
      'some spoons! :spoon::spoon::spoon:',
      'a crown! :crown:',
      'this shoe! :athletic_shoe:',
      'an AOL CD-ROM! :cd:',
      'a mouse! :mouse:',
      'a snake! :snake:',
      'a potion I stole from a laboratory! :test_tube:',
      'the skull of your vanquished enemy! :skull:',
      'a fire extinguisher, which is great for throwing through windows! :fire_extinguisher:',
      'bricks to build things with, or throw through windows! :bricks:',
      'batteries to huck at assailants! :battery::battery:',
      'a bag of legitimately-obtained money! :moneybag:',
      'this hairball I pulled from your shower drain! :shower:',
      'a pill I found on the street! :pill:',
      'a bomb! :bomb:',
      'this bone that I definitely found completely innocently! :bone:',
      'this purse that someone left unattended for a moment! :handbag:',
    ];
    // TODO Handle awkward "I brought you a flower, and a flower" and related
    // cases. It's handled here with string comparison, but probably build up
    // a set of gifts and make sure the latest selection is not already present.
    for (let i = 0; i < giftCount; i += 1) {
      const giftChoice = Math.floor(Math.random() * gifts.length);
      const gift = gifts[giftChoice];

      // Make sure we didn't already give this or a similar gift.
      // This is not a great way to do it, but it will handle the gross
      // cases that we have here for now.
      if (greeting.includes(gift)) {
        // Go again.
        i -= 1;
      } else {
        greeting += `${joiningText} ${gift}`;
        joiningText = ' And also';
      }
    }
    if (giftCount > 1) {
      const multiGiftGreetings = [
        ' Because I really like you. :pleading_face:',
        " Because you're special. :upside_down:",
        ' Because you deserve it. :relaxed:',
      ];
      greeting +=
        multiGiftGreetings[
          Math.floor(Math.random() * multiGiftGreetings.length)
        ];
    }
  }

  const weekend = getWeekendPromptIfMonday(
    now,
    mondayMorningAddendum,
    isMorning,
  );
  if (weekend) {
    greeting += `\n\n${weekend.trim()}`;
  }

  // Add the first-greeting-only bits, if they apply.
  if (motd) {
    greeting += `\n\n${motd.trim()}`;
  }
  if (onThisDay) {
    greeting += `\n\n${onThisDay.trim()}`;
  }

  // Add the weather if it's been a few hours since we last greeted someone.
  if (
    differenceInHours(now, latestGreetingTime) >= 3 ||
    !latestGreetingTime ||
    alwaysWeather
  ) {
    const weather = await buildWeatherMessage(weatherLocation);
    if (weather) {
      greeting += `\n\n${weather.trim()}`;
    }
  } else {
    console.log(
      `skipping weather since it was last shared at ${latestGreetingTime}`,
    );
  }

  const waterPrompt = Math.floor(Math.random() * 7 < 2)
    ? '\n\nBe sure to drink plenty of water today! :sweat_drops:'
    : '';
  greeting += waterPrompt;

  return greeting;
}

// Update last seen entry for this guild member. Will still return
// an in-memory database even if the database cannot be persisted.
function updateLastSeenDB(lastSeenDB, guildMemberId, now) {
  const updated = lastSeenDB;
  updated.lastGreeting = now;
  if (guildMemberId) {
    updated.members[guildMemberId] = now;
  }
  writeFile(lastSeenDBFileName, JSON.stringify(lastSeenDB)).catch(
    (err) => {
      let msg = 'unable to update last seen database';
      if (guildMemberId) {
        msg += ` for guild member ID ${guildMemberId}`;
      }

      // TODO This is a problem because we'll greet a user every time if we
      // can't save, and their last-seen time will stay fixed, and birb will
      // think they haven't been seen in longer and longer.
      console.error(`${msg}: ${err}`);
    },
  );
  return updated;
}

// Load the last-seen database, which is currently a janky JSON
// file. This is fine for low volume usage, though, and simpler
// than trying to connect with an actual database.
function loadLastSeenDB() {
  let lastSeenDB = { members: {} };
  try {
    lastSeenDB = JSON.parse(readFileSync(lastSeenDBFileName));
  } catch (ex) {
    console.error(`unable to read file of last-seen records: ${ex}`);
  }
  return lastSeenDB;
}

// Make a greeter to greet users in the announcement channel when they show up
// in the watched voice channel with their camera on, and haven't been seen yet
// today.
function makeGreeter(config, initialLastSeenDB) {
  const {
    watchChannelId,
    announceChannelId,
    presenceRoleId,
    mondayMorningAddendum,
    botTimeZone,
    devMode,
    weatherLocation,
  } = config;

  let lastSeenDB = initialLastSeenDB;

  const greeter = (oldState, newState) => {
    const left =
      oldState.selfVideo &&
      oldState.channelId === watchChannelId &&
      (!newState.selfVideo || newState.channelId !== watchChannelId);
    if (left) {
      if (oldState.serverMute) {
        oldState
          .setMute(
            false,
            'remove server mute upon leaving silent channel',
          )
          .then(() => {
            console.log(
              `unmuted ${oldState.member.displayName} upon leaving channel`,
            );
          })
          .catch((err) => {
            console.error(
              `unable to unmute ${oldState.member.displayName}: ${err}`,
            );
          });
      }
      if (presenceRoleId) {
        newState.member.roles
          .remove(presenceRoleId)
          .then(() => {
            console.log(
              `removed presence role ${presenceRoleId} for member ${newState.member.displayName}`,
            );
          })
          .catch((err) => {
            console.error(
              `unable to remove presence role ${presenceRoleId} for member ${newState.member.displayName}: ${err}`,
            );
          });
      }
      return;
    }

    const joined =
      newState.selfVideo &&
      newState.channelId === watchChannelId &&
      (!oldState.selfVideo || oldState.channelId !== watchChannelId);

    if (!joined) {
      return;
    }

    if (presenceRoleId) {
      newState.member.roles
        .add(presenceRoleId)
        .then(() => {
          console.log(
            `added presence role ${presenceRoleId} for member ${newState.member.displayName}`,
          );
        })
        .catch((err) => {
          console.error(
            `unable to add presence role ${presenceRoleId} for member ${newState.member.displayName}: ${err}`,
          );
        });
    }

    const memberId = newState.member.id;
    const lastSeenUTC = lastSeenDB.members
      ? lastSeenDB.members[memberId]
      : null;
    const latestGreetingTimeUTC = lastSeenDB.lastGreeting;
    const nowUTC = new Date();

    lastSeenDB = updateLastSeenDB(lastSeenDB, memberId, nowUTC);

    // Make sure we haven't already greeted this guild member today. Don't do
    // this check if we're in dev mode, to make testing easier.
    if (lastSeenUTC) {
      const lastSeen = utcToZonedTime(lastSeenUTC, botTimeZone);
      const now = utcToZonedTime(nowUTC, botTimeZone);
      if (!devMode.alwaysGreet && isSameDay(lastSeen, now)) {
        console.log(
          `refusing to greet ${memberId} more than once today`,
        );
        return;
      }
    }

    newState.client.channels
      .fetch(announceChannelId)
      .then(async (chan) => {
        if (!chan.isText()) {
          console.error(
            `expected channel ${announceChannelId} to be a text channel`,
          );
          return;
        }

        chan.sendTyping().catch((err) => {
          console.error(`failed to send typing event: ${err}`);
        });

        const now = utcToZonedTime(nowUTC, botTimeZone);
        const lastSeen = lastSeenUTC
          ? utcToZonedTime(lastSeenUTC, botTimeZone)
          : null;
        const latestGreetingTime = latestGreetingTimeUTC
          ? utcToZonedTime(latestGreetingTimeUTC, botTimeZone)
          : null;

        const greetOpts = {
          mondayMorningAddendum,
          giftProbability: devMode.alwaysGift ? 100 : 60,
          extraGiftProbability: devMode.alwaysExtraGift ? 100 : 18,
          goodToSeeYouDays: devMode.alwaysGoodToSeeYou ? 0 : 7,
          alwaysGreet: devMode.alwaysGreet,
          alwaysFirst: devMode.alwaysFirst,
          alwaysWeather: devMode.alwaysWeather,
          weatherLocation,
        };

        // TODO random values should be parameterized, for testing.
        //      (i.e., move the random calls out of buildGreeting)
        // TODO gifts should be passed in as a parameter.
        const greeting = await buildGreeting(
          newState.member,
          newState.channel,
          now,
          lastSeen,
          latestGreetingTime,
          greetOpts,
        );

        console.log(
          `saying hello to ${newState.member.displayName}!`,
        );

        // Wait a few seconds to make the interaction feel a bit more "natural,"
        // then send the greeting.
        setTimeout(
          () => {
            chan.send(greeting);
            if (!newState.mute) {
              newState
                .setMute(true, 'This is a silent channel')
                .then(() => {
                  console.log(`muted ${newState.member.displayName}`);
                  chan.send(
                    `FYI, ${newState.member}, I muted you because this is a silent channel!`,
                  );
                })
                .catch((err) => {
                  console.error(
                    `failed to mute user ${newState.member.displayName}: ${err}`,
                  );
                });
            }
          },
          devMode.alwaysGreet ? 0 : greetingDelayMs,
        );
      })
      .catch((err) => {
        console.error(
          `error greeting member ${newState.member.displayName} in ${announceChannelId}: ${err}`,
        );
      });
  };

  return greeter;
}

function maybeReact(message, watchChannelId) {
  if (message.author.bot) {
    return;
  }

  // Make sure only to look at messages in the same guild as the watched voice
  // channel.
  message.guild.channels
    .fetch()
    .then((channels) => {
      if (!channels.has(watchChannelId)) {
        return;
      }

      // Note: Cannot use a literal bird emoji here for some reason: Discord
      // complains about it being an unknown emoji, even though the cowboy below
      // works fine.
      const birdEmoji = String.fromCodePoint(0x1f426);

      const { content, mentions } = message;

      // Note: a mention suffixed by certain punctuation (e.g., "!", ".", ":")
      // results in a role mention rather than a user mention (for some reason I
      // don't know), so we need to look for the bot's role being mentioned in
      // addition to the bot's user.
      const botUserMentioned = mentions.users.has(
        message.guild.me.id,
      );
      const botRoleMentioned = mentions.roles.has(
        message.guild.me.roles.botRole?.id,
      );
      if (botUserMentioned || botRoleMentioned) {
        message
          .react(birdEmoji)
          .catch((err) =>
            console.error(
              `unable to react with ${birdEmoji} to message: ${err}`,
            ),
          );

        if (content.match(/\b(?:thank(?:s| you)|t\/?y)\b/i)) {
          const youreWelcome = [
            "Oh, you're welcome! :relaxed:",
            'Cheep cheep! Of course! :bird:',
            "You bet! I'd do anything for you! :upside_down:",
          ];
          const reply =
            youreWelcome[
              Math.floor(Math.random() * youreWelcome.length)
            ];
          message
            .reply(reply)
            .then(() => {
              console.log(
                `replied to mention by ${message.member?.displayName}`,
              );
            })
            .catch((err) => {
              console.err(
                `error replying to mention by ${message.member?.displayName}: ${err}`,
              );
            });
        }
      }

      if (content.match(/\bhowdy\b/i)) {
        const cowboyEmoji = '🤠';
        message
          .react(cowboyEmoji)
          .catch((err) =>
            console.error(
              `unable to react with ${cowboyEmoji} to message: ${err}`,
            ),
          );
      }
      if (content.match(/\b(?:hello)?bir[bd]\b/i)) {
        message
          .react(birdEmoji)
          .catch((err) =>
            console.error(
              `unable to react with ${birdEmoji} to message: ${err}`,
            ),
          );
      }
      if (content.match(/\b(?:throat[- ]?)?punch(?:ed|ing)?\b/i)) {
        const fistEmoji = '🤜';
        const boomEmoji = '💥';
        message
          .react(fistEmoji)
          .then(() =>
            message
              .react(boomEmoji)
              .catch((err) =>
                console.error(
                  `unable to react with ${boomEmoji} to message: ${err}`,
                ),
              ),
          )
          .catch((err) =>
            console.error(
              `unable to react with ${fistEmoji} to message: ${err}`,
            ),
          );
      }
      if (content.match(/\bstab(?:bed|bing)?\b/i)) {
        const daggerEmoji = '🗡';
        message
          .react(daggerEmoji)
          .catch((err) =>
            console.error(
              `unable to react with ${daggerEmoji} to message: ${err}`,
            ),
          );
      }
    })
    .catch((err) => {
      console.error(`error fetching channels: ${err}`);
    });
}

// Initialize the client to handle the events we care about.
// At this point, just voice state changes.
function initClient(config) {
  console.log(config);
  if (!config.botTimeZone) {
    throw new Error('bot time zone is required');
  }

  // Create a new client instance.
  const botIntents = new Intents();
  botIntents.add(
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  );
  const client = new Client({ intents: botIntents });

  // Announce (locally) when the bot is ready.
  client.once('ready', () => {
    console.log("Cheep cheep! I'm ready to greet!");
    client.user.setActivity('for friends', { type: 'WATCHING' });

    // Occasionally update activity status.
    const thirtyMinutes = 30 * 60 * 1000;
    setInterval(() => {
      const now = utcToZonedTime(new Date(), config.botTimeZone);
      const hour = now.getHours();

      // TODO Get actual sunrise and sunset times.
      if (hour >= 6 && hour <= 8) {
        client.user.setActivity('the sunrise', { type: 'WATCHING' });
      } else {
        const n = Math.floor(Math.random() * 100);
        if (n < 25) {
          client.user.setActivity('outside', { type: 'PLAYING' });
        } else if (n < 50) {
          const watching = [
            '30 Rock',
            'Parks and Rec',
            'Brooklyn 99',
            'Planet Earth',
            'The Punisher',
            "Bob's Burgers",
            'Rick and Morty',
            'bird documentaries',
            'Bird Game',
            'The Birds',
            'Russian dash cam footage',
            'the world burn 🔥',
          ];
          const watchingIdx = Math.floor(
            Math.random() * watching.length,
          );
          client.user.setActivity(watching[watchingIdx], {
            type: 'WATCHING',
          });
        } else if (n < 60) {
          client.user.setActivity('"Surfin\' Bird" by The Trashmen', {
            type: 'LISTENING',
          });
        } else {
          client.user.setActivity('for friends', {
            type: 'WATCHING',
          });
        }
      }
    }, thirtyMinutes);
  });

  client.on('messageCreate', (message) => {
    maybeReact(message, config.watchChannelId);
  });

  // Watch for users turning on their cameras in a voice channel.
  const lastSeenDB = loadLastSeenDB();
  const greeter = makeGreeter(config, lastSeenDB);
  client.on('voiceStateUpdate', greeter);

  return client;
}

console.log('starting up!');

// Read config and init client.
dotEnvConfig();
const config = {
  watchChannelId: process.env.WATCH_VOICE_CHANNEL_ID,
  announceChannelId: process.env.ANNOUNCE_CHANNEL_ID,
  presenceRoleId: process.env.PRESENCE_ROLE_ID,
  botTimeZone: process.env.BOT_TIME_ZONE || 'UTC',
  mondayMorningAddendum: process.env.MONDAY_MORNING_ADDENDUM,
  weatherLocation: process.env.WEATHER_GOV_OFFICE_AND_GRID,

  // Dev Mode Options:
  // alwaysGreet
  // alwaysFirst
  // alwaysGift
  // alwaysExtraGift
  // alwaysGoodToSeeYou
  // alwaysWeather
  devMode: (process.env.DEV_MODE || '')
    .split(',')
    .filter((s) => s.length > 0)
    .reduce((o, key) => ({ ...o, [key.trim()]: true }), {}),
};
const client = initClient(config);

// Start our ping/healthcheck endpoint.
http
  .createServer((req, res) => {
    res.write('hellobirb bot is running! chirp! chirp!');
    res.end();
  })
  .listen(process.env.PORT || 8080);

// Start the bot!
const token = process.env.BOT_TOKEN;
client.login(token);
