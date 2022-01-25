import { config as dotEnvConfig } from 'dotenv';

function readConfig() {
  dotEnvConfig();
  const config = {
    guildId: process.env.GUILD_ID,
    watchChannelId: process.env.WATCH_VOICE_CHANNEL_ID,
    announceChannelId: process.env.ANNOUNCE_CHANNEL_ID,
    presenceRoleId: process.env.PRESENCE_ROLE_ID,
    botTimeZone: process.env.BOT_TIME_ZONE || 'UTC',
    mondayMorningAddendum: process.env.MONDAY_MORNING_ADDENDUM,
    weatherLocation: process.env.WEATHER_GOV_OFFICE_AND_GRID,
    typingDelayMs: process.env.TYPING_DELAY_MS || 3000,

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

  return config;
}

export default readConfig;
