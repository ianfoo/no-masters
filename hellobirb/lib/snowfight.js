function snowfightReact(msg, guildId) {
  const snowballBotId = '914971233379045406';
  if (msg.guildId !== guildId || msg.author.id !== snowballBotId) {
    return;
  }

  const embed = msg.embeds[0];
  const hitColor = 6356832;
  if (embed.color !== hitColor) {
    return;
  }

  const hellobirbMention = '<@891908176356712459>';
  if (true || embed?.description.includes(hellobirbMention)) {
    // Hellobirb was hit. Exact vengeance.
    const thrower = msg.interaction?.user;
    console.log(`snowball hit by ${thrower}!`);
    const reactionGifs = [
      'https://media2.giphy.com/media/xUySTqYAa9n6awCiSk/giphy.gif',
      'https://c.tenor.com/DrU8PT2Qj2oAAAAC/kill-it-with-fire-fire.gif',
      'https://media1.giphy.com/media/9GIF5KfVkGEllkQyz9/giphy.gif?',
      'https://i.imgur.com/DIeqX40.gif',
      'https://media1.giphy.com/media/xUySTZhLpepqXCl5Dy/giphy.gif',
      'https://c.tenor.com/48IYu9PI9wMAAAAC/man-throw.gif',
      'https://media0.giphy.com/media/lF5bH6enH9F1m/giphy.gif',
      'https://media2.giphy.com/media/xIytx7kHpq74c/giphy.gif',
      'https://media4.giphy.com/media/OgRsVkXWDLbXi/giphy.gif',
      'https://media1.giphy.com/media/rhYsUMhhd6yA0/giphy.gif',
    ];
    const reactionGif =
      reactionGifs[Math.floor(Math.random() * reactionGifs.length)];

    const descriptions = [
      `${thrower}, prepare to be hit!`,
      `${thrower}, prepare to meet your doom!`,
      `${thrower}, prepare to be pelted into the infinite!`,
      `You're mine, ${thrower}!`,
    ];
    const description =
      descriptions[Math.floor(Math.random() * descriptions.length)];

    const titles = [
      'vengeance :knife:',
      'doom :boom:',
      'your demise :skull:',
      'you poor fool :pensive:',
    ];
    const title = titles[Math.floor(Math.random() * titles.length)];

    setTimeout(() => {
      msg.channel.sendTyping();
    }, 2000);
    setTimeout(() => {
      msg.channel
        .send({
          embeds: [
            {
              title,
              description,
              color: 'FF2A00',
              image: {
                url: reactionGif,
              },
            },
          ],
        })
        .then(() => {
          console.log(`retaliated at ${thrower} for snowball hit`);
        });
    }, 5000);

    // Hellobirb was hit and has retaliated; we are done here.
    // return;
  }

  // Someone else was hit. Maybe laugh at them.
  const thrower = msg.interaction?.user;
  const targetRe = /<@\d{18}>/;
  const targetResults = targetRe.exec(embed.description);
  if (!targetResults) {
    return;
  }
  const target = targetResults[0];

  const specialUsersProbability = {
    '<@250825783755407373>': 0.8,
    '<@807036137989472286>': 0.4,
  };
  const laughProbability = 1; // specialUsersProbability[target] || 0.2;

  if (Math.random() < laughProbability) {
    const taunts = [
      `Haha, ${thrower} hit ${target} with a snowball! :joy:`,
      `${target} totally had that coming. Good job ${thrower}! :raised_hands:`,
      `Bwahahaha! You can barely recognize ${target} with all that snow on their face! :joy:`,
      `Oh snap! ${thrower} totally _owned_ ${target} with that one! :grin:`,
      `${target} looks much nicer covered in snow, don't you think? :bird:`,
    ];
    const taunt = taunts[Math.floor(Math.random() * taunts.length)];
    setTimeout(() => {
      msg.channel.sendTyping();
    }, 2000);
    setTimeout(() => {
      msg.reply(taunt).then(() => {
        console.log(`laughed at snowball target ${target}`);
      });
    }, 1000 * 5);
  }
}

export default snowfightReact;
