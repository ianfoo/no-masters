import { Client, Intents } from 'discord.js';
import { readFileSync } from 'fs';
import readConfig from './lib/config.js';

async function initClient(config) {
  if (!config.botTimeZone) {
    throw new Error('bot time zone is required');
  }

  // Create a new client instance.
  const botIntents = new Intents();
  botIntents.add(Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES);
  const client = new Client({ intents: botIntents });
  const token = process.env.BOT_TOKEN;
  await client.login(token);
  return client;
}

async function sendMessage(file) {
  const config = readConfig();
  const client = await initClient(config);

  const fileContents = readFileSync(file).toString();
  let message;

  if (file.endsWith('.json') || fileContents[0] === '{') {
    // Message is a JSOn file, so make a message with an embed.
    const msg = JSON.parse(fileContents);
    let embed = {
      title: ':calendar: On This Day! :sparkles:',
      color: 'B024B1',
    };
    embed = { ...embed, ...msg };
    message = {
      embeds: [embed],
    };
  } else {
    // Message is a string, so just trim it and set it as the message.
    message = fileContents.trim();
  }

  const { announceChannelId: channelId } = config;
  client.on('ready', async (c) => {
    console.log('client ready');
    const channel = await c.channels.fetch(channelId);
    console.log(`got channel ${channel.name}`);
    await channel.send(message);
    console.log('sent message');

    client.destroy();
  });
}

console.log('starting');
const file = process.argv[2];
if (!file) {
  console.error('a filename is required');
  process.exitCode = 1;
  process.exit();
}
sendMessage(file);
