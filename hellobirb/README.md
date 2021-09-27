# hellobirb

**hellobirb** is a little bot that watches for users entering
a voice channel with their cameras on. If it hasn't seen them yet today, it will
send a greeting to a text channel. It can even give a special extra notice on
Monday mornings.

### Configuration
Configuration is done through environment files, or an `.env` file, which will
be read on startup.

Configuration options are the following:

Environment Variable | Notes
-------------------- | -----
BOT_TOKEN | Discord token from developer portal. This is required.
WATCH_VOICE_CHANNEL_ID | The Discord ID for the voice channel to watch. This is required.
ANNOUNCE_CHANNEL_ID | The Discord ID for the text channel to send messages on. This is required.
BOT_TIME_ZONE | Name of the time zone (e.g., America/Los_Angeles) that the bot is running in. Defaults to UTC if not specified. Per-user time zones are not available in Discord, so allowing the bot to specify is the best that we can do.
PORT | Port on which to serve HTTP for the health-check page.
DEV_MODE | Set to a non-blank value to keep the last-seen database from being updated. For testing purposes.

### TO DO
Notes for enhancement are written near the top of `index.js`.  Notes for
installing/running should be added here, but there's not much to talk about yet
since this is currently deployed in an "artisan" manner, lovingly placed by hand
on a small VM, protected by a process monitor, writing logs that will never be
rotated.