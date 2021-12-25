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
  if (embed?.description.includes(hellobirbMention)) {
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
    return;
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
    '<@622099233176158218>': 0.4, // Will
    '<@250825783755407373>': 0.4, // Zaq
  };
  const laughProbability = specialUsersProbability[target] || 0.2;

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

    // Birb has laughed at the target. We're done here.
    return;
  }

  // Look for keywords to react to in the hit message.
  if (embed?.description.contains('doot doot')) {
    const dootDootGifs = [
      'https://c.tenor.com/HcnatKp3NkkAAAAC/trumpet-middlefinger.gif',
      'https://c.tenor.com/gYGHTkX9PX0AAAAd/louis-armstrong.gif',
      'https://c.tenor.com/6YLyrvVA5X4AAAAd/muppets-muppet-show.gif',
      'https://c.tenor.com/bSLC9u5P5CUAAAAC/m%C3%BAsica-instrument.gif',
      'https://c.tenor.com/o9RZrhOOFj8AAAAC/spongebob-sweet-victory.gif',
      'https://c.tenor.com/ySRwF-YfeHUAAAAC/basketball-wives-woot-woot.gif',
    ];
    const dootDootGif =
      dootDootGifs[Math.floor(Math.random() * dootDootGifs.length)];
    const reply = {
      embeds: [
        {
          title: 'The trumpets of war :trumpet:',
          description: '**DOOT DOOT, MOFOS!**',
          color: 'FFD700',
          image: {
            url: dootDootGif,
          },
        },
      ],
    };
    setTimeout(() => {
      msg.channel.sendTyping();
    }, 2000);
    setTimeout(() => {
      msg.reply(reply).then(() => {
        console.log('offered doot doot war cry after snowball hit');
      });
    }, 1000 * 5);
  }
}

export default snowfightReact;
