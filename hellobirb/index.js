import { Client, Intents } from 'discord.js';
import { config as dotEnvConfig } from 'dotenv';
import { readFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { intervalToDuration } from 'date-fns';
import tzPkg from 'date-fns-tz';
const { utcToZonedTime } = tzPkg;
import * as http from 'http';

const greetingDelayMs = 3000;
const lastSeenDBFileName = 'last-seen.json';

// TODO
// * Make this a bit more sane, code-wise. Split into a couple files.
// * SQLite last-seen database?
// * Handle multiple servers.
// * Reply/react to mentions and reactions on sent messages.
// * Validation of configuration (e.g., non-empty channel IDs).
// * Custom greetings/greeting fragments for specially-configured users.
// * Add Guild IDs since member IDs are the same as user IDs.
// * Read/write from files not located in run directory (e.g., XDG_CONFIG_HOME).

// Build a time-aware greeting for the user who has just joined.
// Does not take into account the user's local time, but there
// doesn't appear to be any timezone data available for Discord
// users.
function buildGreeting(
	member,
	channel,
	now,
	lastSeen,
	{
		mondayMorningAddendum,
		giftProbability,
		extraGiftProbability,
		goodToSeeYouDays,
		alwaysGreet,
	},
) {
	const hour = now.getHours();
	const isLateNight = hour < 5;
	const isMorning = hour >= 5 && hour < 12;
	const isEarlyMorning = hour >= 5 && hour < 8;
	const isAfternoon = hour >= 12 && hour < 17;
	const isEarlyEvening = hour >= 17 && hour < 20;
	const isLateEvening = hour >= 20;

	let greeting = ':bird: ';
	if (isLateNight) {
		greeting += `You're burning the midnight oil, ${member}! :crescent_moon:`;
	}
	else if (isMorning) {
		greeting += `Good morning, ${member}! `;
		greeting += isEarlyMorning
			? ':sunrise_over_mountains:'
			: ':white_sun_cloud:';
	}
	else if (isAfternoon) {
		greeting += `Good afternoon, ${member}! :sun_with_face:`;
	}
	else {
		greeting += `Good evening, ${member}! `;
		greeting += isEarlyEvening ? ':city_dusk:' : ':night_with_stars:';
	}

	// Is it Friday yet?!
	if (now.getDay() === 5 || !isLateEvening) {
		greeting += ' Happy Friday! :partying_face:';
	}

	// Try to figure out how long it's been since we last saw this user. If we
	// have no record of last seen, just skip it.
	if (lastSeen) {
		const durationSinceLastSeen = intervalToDuration({
			start: lastSeen,
			end: now,
		});
		const beenAMinute = durationSinceLastSeen.days >= goodToSeeYouDays;
		if (beenAMinute) {
			console.log(
				`${member.id} has popped in for the first time in ${durationSinceLastSeen.days} days`,
			);
			greeting += ' It\'s good to see you again!';

			const beenALongTime = durationSinceLastSeen.day >= 2 * goodToSeeYouDays;
			if (beenALongTime) {
				greeting += ' I\'ve missed you!';
			}
			greeting += ' :relaxed:';
		}
	}

	if (now.getDay() === 1 && isMorning && mondayMorningAddendum) {
		greeting += ' ' + mondayMorningAddendum;
	}

	const weather = '';
	let motd = '';
	let onThisDay = '';

	// TODO Update to check if size == 1 AND most recent greet was not today.
	// We're not currently recording the most recent greet time, but this could
	// just be kept in memory for now.
	if (channel.members.size === 1) {
		greeting += ' You\'re the first one here. ';
		const awardPool = [':first_place:', ':trophy:'];
		const n = Math.floor(Math.random() * awardPool.length);
		const award = awardPool[n];
		greeting += award;

		// Add message of the day, if it exists.
		//
		// TODO Make these scheduled and stored in a database or something better
		// than a text file.
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
		}
		catch (err) {
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
			}
			else if (existsSync(onThisDayWithoutYearFile)) {
				onThisDay = readFileSync(onThisDayWithoutYearFile).toString();
			}
		}
		catch (err) {
			console.error(`error adding "on this day" content: ${err}`);
		}

		// TODO Get weather data from weather API.
	}

	// Maybe present a gift to the arriving user.
	// TODO Make this bonus adjustable per user.
	const userBonus = 0;
	const shouldGift =
		Math.floor(Math.random() * 100) >= 100 - (giftProbability + userBonus);
	if (shouldGift) {
		// Maybe give multiple gifts.
		let giftCount = 1;
		let joiningText = ' I brought you';
		const extraGift = Math.floor(Math.random() * 100);
		if (extraGift >= 100 - extraGiftProbability) {
			giftCount++;
		}
		const gifts = [
			'a flower! :sunflower:',
			'a flower! :rose:',
			'some flowers! :bouquet:',
			'a book I really like! :closed_book:',
			'a poem I wrote! :scroll:',
			'some chocolate! :chocolate_bar:',
			'a cookie! :cookie:',
			'some tea! :tea:',
			'a nice cup of coffee :coffee:',
			'a burrito! :burrito:',
			'a taco! :taco:',
			'some sushi! :sushi:',
			'some takeout! :takeout_box:',
			'a bed! :bed:',
			'a dagger! :dagger:',
			'a potion I stole from a laboratory! :test_tube:',
			'the skull of your enemy! :skull:',
		];
		// TODO Handle awkward "I brought you a flower, and a flower" and related
		// cases. It's handled here with string comparison, but probably build up
		// a set of gifts and make sure the latest selection is not already present.
		for (let i = 0; i < giftCount; i++) {
			const giftChoice = Math.floor(Math.random() * gifts.length);
			const gift = gifts[giftChoice];

			// Make sure we didn't already give this or a similar gift.
			// This is not a great way to do it, but it will handle the gross
			// cases that we have here for now.
			if (greeting.includes(gift)) {
				// Go again.
				i--;
				continue;
			}

			greeting += `${joiningText} ${gift}`;
			joiningText = ' And also';
		}
		if (giftCount > 1) {
			greeting += ' Because I really like you. :pleading_face:';
		}
	}

	// Add the first-greeting-only bits, if they apply.
	if (weather) {
		greeting += '\n\n' + weather.trim();
	}
	if (motd) {
		greeting += '\n\n' + motd.trim();
	}
	if (onThisDay) {
		greeting += '\n\n' + onThisDay.trim();
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
	}
	catch (ex) {
		console.error(`unable to read file of last-seen records: ${ex}`);
	}
	return lastSeenDB;
}

// Update last seen entry for this guild member. Will still return
// an in-memory database even if the database cannot be persisted.
function updateLastSeenDB(lastSeenDB, guildMemberId, now) {
	lastSeenDB[guildMemberId] = now;
	writeFile(lastSeenDBFileName, JSON.stringify(lastSeenDB)).catch((err) =>
		console.error(
			`unable to update last seen database for guild member ID ${guildMemberId}: ${err}`,
		),
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
		const nowUTC = new Date();
		updateLastSeenDB(lastSeenDB, memberId, nowUTC);

		// Make sure we haven't already greeted this guild member today. Don't do
		// this check if we're in dev mode, to make testing easier.
		if (lastSeenUTC) {
			const lastSeen = utcToZonedTime(lastSeenUTC, botTimeZone);
			const now = utcToZonedTime(nowUTC, botTimeZone);
			if (!devMode.alwaysGreet && lastSeen.getDay() == now.getDay()) {
				console.log(`refusing to greet ${memberId} more than once today`);
				return;
			}
		}

		newState.client.channels
			.fetch(announceChannelId)
			.then((chan) => {
				if (!chan.isText()) {
					console.error(
						`expected channel ${announceChannelId} to be a text channel`,
					);
					return;
				}

				const now = utcToZonedTime(nowUTC, botTimeZone);
				const lastSeen = lastSeenUTC
					? utcToZonedTime(lastSeenUTC, botTimeZone)
					: null;

				const greetOpts = {
					mondayMorningAddendum,
					giftProbability: devMode.alwaysGift ? 100 : 60,
					extraGiftProbability: devMode.alwaysExtraGift ? 100 : 18,
					goodToSeeYouDays: devMode.alwaysGoodToSeeYou ? 0 : 7,
					alwaysGreet: devMode.alwaysGreet,
				};

				console.log(greetOpts);

				// TODO random values should be parameterized, for testing.
				//      (i.e., move the random calls out of buildGreeting)
				// TODO gifts should be passed in as a parameter.
				const greeting = buildGreeting(
					newState.member,
					newState.channel,
					now,
					lastSeen,
					greetOpts,
				);

				console.log(`saying hello to ${newState.member}!`);
				chan.sendTyping();

				// Wait a few seconds to make the interaction feel a bit more "natural,"
				// then send the greeting.
				setTimeout(
					() => chan.send(greeting),
					devMode.alwaysGreet ? 0 : greetingDelayMs,
				);
			})
			.catch((err) => {
				console.error(
					`error fetching announcement channel ${announceChannelId}: ${err}`,
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
	client.once('ready', () => {
		console.log('Cheep cheep! I\'m ready to greet!');
		client.user.setActivity('for friends', { type: 'WATCHING' });

		// Occasionally update activity status.
		const tenMinutes = 10 * 60 * 1000;
		setInterval(() => {
			const now = new Date();
			const hour = now.getHours();

			// TODO Get actual sunrise and sunset times.
			if (hour >= 6 && hour <= 8) {
				client.user.setActivity('the sunrise', { type: 'WATCHING' });
			}
			else {
				const n = Math.floor(Math.random() * 100);
				if (n < 25) {
					client.user.setActivity('outside', { type: 'PLAYING' });
				}
				else if (n < 45) {
					client.user.setActivity('30 Rock', { type: 'WATCHING' });
				}
				else {
					client.user.setActivity('for friends', { type: 'WATCHING' });
				}
			}
		}, tenMinutes);
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
	botTimeZone: process.env.BOT_TIME_ZONE || 'UTC',
	mondayMorningAddendum: process.env.MONDAY_MORNING_ADDENDUM,

	// Dev Mode Options:
	// alwaysGreet
	// alwaysGift
	// alwaysExtraGift
	// alwaysGoodToSeeYou
	devMode: (process.env.DEV_MODE || '')
		.split(',')
		.filter((s) => s.length > 0)
		.reduce((o, key) => ({ ...o, [key.trim()]: true }), {}),
};
const client = initClient(config);

// Start our ping/healthcheck endpoint.
http
	.createServer((req, res) => {
		res.write('hellobirb bot is running!');
		res.end();
	})
	.listen(process.env.PORT || 8080);

// Start the bot!
const token = process.env.BOT_TOKEN;
client.login(token);
