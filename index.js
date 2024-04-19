/* eslint-disable no-fallthrough */
const print = console.log;
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, AttachmentBuilder, ActivityType } = require('discord.js');
const config = require('./config.js')
const moment = require('moment')
const axios = require('axios').create({ timeout: 5 * 60 * 1000 })
const sharp = require('sharp');
const { I18n } = require('i18n');
const path = require('path');
const fs = require('fs');

function applyLang(target) {
  const locale = target.locale || 'en'
  new I18n({
    register: target,
    defaultLocale: 'en',
    fallbacks: {
      'en-*': 'en',
      'es-*': 'es',
      'pt-*': 'pt',
      'sv-*': 'sv',
      'zh-*': 'zh',
    },
    directory: path.join(__dirname, 'locales'),
    autoReload: false,
    updateFiles: false,
    syncFiles: false,
    logDebugFn: ()=>{},
    logWarnFn: ()=>{},
    logErrorFn: print,
  });
  target.setLocale(locale)
}
applyLang({}) //test for logging errors at start


let time = new Date()
const bs = require('better-sqlite3')('database.sqlite');
bs.exec("CREATE TABLE IF NOT EXISTS codes (code TEXT NOT NULL UNIQUE ON CONFLICT IGNORE, used BOOL DEFAULT FALSE)")
bs.exec("CREATE TABLE IF NOT EXISTS nitro_codes (code TEXT NOT NULL UNIQUE ON CONFLICT IGNORE, used BOOL DEFAULT FALSE)");
bs.exec("CREATE TABLE IF NOT EXISTS generic_codes (code TEXT NOT NULL UNIQUE, expired BOOL DEFAULT FALSE)");
bs.exec("CREATE TABLE IF NOT EXISTS players (discordid TEXT NOT NULL, playerid TEXT NOT NULL, code TEXT NOT NULL, date DATETIME DEFAULT CURRENT_TIMESTAMP)");

if (fs.existsSync('codes.txt')) {
  const stmt = bs.prepare('INSERT INTO codes (code) VALUES (?)');
  bs.transaction(() => {
      let allFileContents = fs.readFileSync('codes.txt', 'utf-8');
      allFileContents.split(/\r?\n/).forEach(line =>  {
          line = line.trim()
          if (line.length) {
            try {
              stmt.run(line);
            } catch (error) {}
          }
      });
  })()
  fs.rmSync('codes.txt')
}

if (fs.existsSync('nitro.txt')) {
  const stmt = bs.prepare('INSERT INTO nitro_codes (code) VALUES (?)');
  bs.transaction(() => {
      let allFileContents = fs.readFileSync('nitro.txt', 'utf-8');
      allFileContents.split(/\r?\n/).forEach(line =>  {
          line = line.trim()
          if (line.length) {
            try {
              stmt.run(line);
            } catch (error) {}
          }
      });
  })()
  fs.rmSync('nitro.txt')
}

let row = bs.prepare(`SELECT
(SELECT count() FROM codes where used=0) as codes_left,
(SELECT count() FROM codes) as codes_total,
(SELECT count() FROM nitro_codes where used=0) as nitro_left,
(SELECT count() FROM nitro_codes) as nitro_total
`).get()

print(`Done loading codes! ${(new Date() - time) / 1000}s
Normal codes remaining: ${Math.round(row.codes_left / row.codes_total * 100)}% (${row.codes_left} / ${row.codes_total})
Nitro codes remaining: ${Math.round(row.nitro_left / row.nitro_total * 100)}% (${row.nitro_left} / ${row.nitro_total})
`)

// bs.close()






const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');


async function presentCaptcha(interaction, playerId) {
  let genRes = await axios.post(`https://${config.host}/api/v1/captcha/generate`).catch(() => {});
  if (!genRes || genRes.status != 200 || !genRes.data) {
    return await interaction.editReply({ content: interaction.__('Failed getting captcha. Try again later.') });
  }
  if (genRes.data.code != 0 || !genRes.data.data || !genRes.data.data.captchaId) {
    return await interaction.editReply({ content: interaction.__('Failed getting captcha. Try again later.') });
  }

  let captchaId = genRes.data.data.captchaId;
  let imageRes = await axios.get(`https://${config.host}/api/v1/captcha/image/${captchaId}`, { responseType: 'arraybuffer' }).catch(() => {});
  if (!imageRes || imageRes.status != 200 || !imageRes.data || !imageRes.data.length) {
    return await interaction.editReply({ content: interaction.__('Failed getting captcha. Try again later.') });
  }

  let data = await sharp(imageRes.data).flatten({ background: { r: 255, g: 255, b: 255 } }).toFormat('png').toBuffer()
  const captcha = new AttachmentBuilder(data, { name: 'captcha.png' });

  let enterButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`captcha-${playerId}-${captchaId}`)
        .setLabel(interaction.__('Solve captcha'))
        .setStyle(ButtonStyle.Primary),
    );
  return await interaction.editReply({ content: interaction.__('Please enter the captcha below'), files: [captcha], components: [enterButton] });
}



async function presentIdModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('idModal')
    .setTitle(interaction.__('Enter player id'));
  const playerIdInput = new TextInputBuilder()
    .setCustomId('playerId')
    .setLabel(interaction.__('Enter player id'))
    .setMinLength(4)
    .setMaxLength(10)
    .setStyle(TextInputStyle.Short);
  
  let row = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM players WHERE discordId=? ORDER BY date DESC LIMIT 1', [interaction.user.id], (err, row) => {
      if (err) { reject(err) } else { resolve(row) }
    })
  })
  if (row && row.playerid) {
    playerIdInput.setValue(row.playerid)
  }
  
  modal.addComponents(new ActionRowBuilder().addComponents(playerIdInput));
  try {
    await interaction.showModal(modal);
  } catch (error) {
    print("Discord interaction error attempting to show playerID modal :(")
  }
}

async function presentCaptchaModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(interaction.customId)
    .setTitle(interaction.__('Solve captcha'));
  const captchaInput = new TextInputBuilder()
    .setCustomId('captcha')
    .setLabel(interaction.__('What is the captcha solution'))
    .setMinLength(4)
    .setMaxLength(4)
    .setStyle(TextInputStyle.Short);
  modal.addComponents(new ActionRowBuilder().addComponents(captchaInput));
  try {
    await interaction.showModal(modal);
  } catch (error) {
    print("Discord interaction error attempting to show captcha modal :(")
  }
}


async function checkCanClaim(interaction, playerId) {
  let row = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM players WHERE discordId=? OR playerId=? ORDER BY date DESC LIMIT 1', [interaction.user.id, playerId], (err, row) => {
      if (err) { reject(err) } else { resolve(row) }
    })
  })

  if (row && row.date) {
    let prevClaim = moment(new Date(row.date)).utc();

    let claimDate = prevClaim.clone().utc();
    if (interaction.member.premiumSinceTimestamp && prevClaim.date() < 16) {
      claimDate.date(16);
    } else {
      claimDate.second(0).minute(0).hour(0).date(1).month(prevClaim.month()+1)
    }

    if (claimDate > moment()
      // && !config.isDeveloper(interaction.user.id)
      ) {
      await interaction.editReply({ content: interaction.__('You cannot claim another code until %s', `<t:${claimDate.unix()}:f> <t:${claimDate.unix()}:R>`), ephemeral: true });
      return false
    }
  }

  return true
}







const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
	],
  partials: [
    Partials.Channel,
    Partials.Message
  ],
});

client.on("ready", async () => {
  console.log(`Bot has started`); 
  client.user.setActivity(config.game, { type: ActivityType.Playing });


  let channel = client.channels.cache.get(config.logChannel);
  if (!channel) {
    print(`Log channel ${config.logChannel} not found!`)
    process.exit(1)
  }

  if (!channel.guild.members.me.permissionsIn(channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], true)) {
    print("Missing permissions to post in log channel")
    process.exit(1)
  }

  client.guilds.fetch().then((guilds) => {
    for (let [_, guild] of guilds) {
      client.guilds.fetch(guild.id).then(g => {
        print(guild.id, guild.name, g.memberCount)
      })
    }
  })
});

client.on('interactionCreate', async interaction => {
  // interaction.locale = 'kr'
  applyLang(interaction)
  
  if (config.isDeveloper(interaction.user.id) && interaction.member) {
    interaction.member.premiumSinceTimestamp = 1
  }
  //interaction.member.premiumSinceTimestamp = 0 //disable all nitro

	if (interaction.isChatInputCommand()) {
    if (interaction.channel.isDMBased() && !config.isDeveloper(interaction.user.id)) {
      return await interaction.reply("NO DM!")
    }
    if (interaction.commandName === 'about') {
      let ephemeral = !interaction.guild.members.me.permissionsIn(interaction.channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], true);

      return await interaction.reply({ content: `Coded by \`Reformed#1337\`
Korean by \`Bee🐝#7132\` and \`신우#2544\`
Vietnamese by \`Violet57#5009\`
Dutch by \`vSolarian#5950\`
French by \`Fukuda#9980\`
Portuguese by \`Halt#2768\`
Lithuanian by \`Supra#3918\`
Swedish by \`Timmetott#2528\`
Spanish by \`jmedelotti#6079\`
German by \`Choooki#1065\`
Ukrainian by \`PlayMe#1288\`
`, ephemeral: ephemeral})
    }



    if (interaction.commandName === 'status') {
      let before = new Date()
      interaction.reply({ content: `Checking...`, ephemeral: false, fetchReply: true}).then (async (message) => {
        let after = new Date()
        db.get(`SELECT
        (SELECT count() FROM codes where used=0) as codes_left,
        (SELECT count() FROM codes) as codes_total,
        (SELECT count() FROM nitro_codes where used=0) as nitro_left,
        (SELECT count() FROM nitro_codes) as nitro_total
        `, [], (err, row) => {
          interaction.editReply(`Real time total ${new Date() - before}ms | API ${message.createdTimestamp - interaction.createdTimestamp}ms | WS ${Math.round(client.ws.ping)}ms | DB ${new Date() - after}ms
Normal codes remaining: ${Math.round(row.codes_left / row.codes_total * 100)}% (${row.codes_left} / ${row.codes_total})
Nitro codes remaining: ${Math.round(row.nitro_left / row.nitro_total * 100)}% (${row.nitro_left} / ${row.nitro_total})
`);
        })
      })
    }

   


    if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return await interaction.reply({ content: `Sorry only admins :(`, ephemeral: true });
    }
    

    if (interaction.commandName === 'post') {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      const label = interaction.options.getString('label');

      if (!interaction.guild.members.me.permissionsIn(channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], true)) {
        return await interaction.reply({ content: `ERROR missing permissions to post in that channel.`, ephemeral: true });
      }

      await channel.send({
        content: message,
        components: [new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('getCode')
              .setLabel(label)
              .setStyle(ButtonStyle.Primary),
          )
        ]
      })

      return await interaction.reply({ content: `Posted!`, ephemeral: true });
    }

    if (interaction.commandName === 'code') {
      await interaction.reply({ content: `Fetching a code. Hold on one moment.`, ephemeral: false });

      let row = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM codes WHERE used=FALSE ORDER BY RANDOM() LIMIT 1', [], (err, row) => {
          if (err) { reject(err) } else { resolve(row) }
        })
      })
      if (!row || !row.code) {
        return await interaction.editReply({ content: interaction.__('Sorry there are no more codes available!'), components: [], files: [] });
      }

      db.run("UPDATE codes SET used=TRUE WHERE code = ?", [row.code], () => {});
      return await interaction.editReply({ content: `Your code is \`${row.code}\`!`, components: [], files: [] });
    }


    if (interaction.commandName === 'lookup') {
      if (interaction.options.getSubcommand() === 'user') {
        let user = interaction.options.getMember('target');
        db.all('SELECT * FROM players WHERE discordId=? ORDER BY date DESC', [user.id], async (err, rows) => {
          let msg = rows.map((row) => {
            let claimDate = moment(new Date(row.date)).unix();
            return `Discord: \`${row.discordid}\` PlayerID: \`${row.playerid}\` Code: \`${row.code}\` RedeemedAt: <t:${claimDate}:f> <t:${claimDate}:R>`
          }).join('\n')
          return await interaction.reply({ content: msg || "None", ephemeral: false });
        });
      }
      if (interaction.options.getSubcommand() === 'id') {
        let playerId = interaction.options.getString('target');
        if (!/^\d+$/.test(playerId)) {
          return await interaction.reply({ content: interaction.__('Invalid playerID \`%s\`. Please check again.', playerId), ephemeral: true });
        }
        db.all('SELECT * FROM players WHERE playerId=? ORDER BY date DESC', [playerId], async (err, rows) => {
          let msg = rows.map((row) => {
            let claimDate = moment(new Date(row.date)).unix();
            return `Discord: \`${row.discordid}\` PlayerID: \`${row.playerid}\` Code: \`${row.code}\` RedeemedAt: <t:${claimDate}:f> <t:${claimDate}:R>`
          }).join('\n')
          return await interaction.reply({ content: msg || "None", ephemeral: false });
        });
      }
    }
  
  
  } else if (interaction.isButton()) {
    if (interaction.customId == 'getCode') {
      return await presentIdModal(interaction);
    }


    let parts = interaction.customId.split('-')
    if (parts[0] == 'captcha') {
      return await presentCaptchaModal(interaction)
    }




  } else if (interaction.isModalSubmit()) {
    if (interaction.customId == 'idModal') {
      await interaction.reply({ content: interaction.__('Checking...'), ephemeral: true });

      const playerId = interaction.fields.getTextInputValue('playerId');
      if (!/^\d+$/.test(playerId)) {
        return await interaction.editReply({ content: interaction.__('Invalid PlayerID \`%s\`. Please check again.', playerId), ephemeral: true });
      }


      if (!await checkCanClaim(interaction, playerId)) { return }

      await interaction.editReply({ content: interaction.__('Fetching captcha...'), ephemeral: true });
      return await presentCaptcha(interaction, playerId);
    }

    let [customId, playerId, captchaId] = interaction.customId.split('-')
    if (customId == 'captcha') {
      await interaction.update({ content: interaction.__('Checking captcha...'), components: [], files: [] })

      const captcha = interaction.fields.getTextInputValue('captcha');
      if (!/^\d+$/.test(captcha) || captcha.length != 4) {
        await interaction.editReply({ content: interaction.__('Invalid captcha, try again') });
        return await presentCaptcha(interaction, playerId)
      }


      if (!await checkCanClaim(interaction, playerId)) { return }

      let table = (interaction.member.premiumSinceTimestamp && moment.utc().date() >= 16) ? "nitro_codes" : "codes"
      let row = await new Promise((resolve, reject) => {
        db.get(`SELECT * FROM ${table} WHERE used=FALSE ORDER BY RANDOM() LIMIT 1`, [], (err, row) => {
          if (err) { reject(err) } else { resolve(row) }
        })
      })
      if (!row || !row.code) {
        return await interaction.editReply({ content: interaction.__('Sorry there are no more codes available!') });
      }

      // https://game.soulssvc.com/habbygame/mail/api/v1/captcha/generate
      // https://mail.survivorio.com/api/v1/giftcode/claim
      let resp = await axios.post(`https://${config.host}/api/v1/giftcode/claim`, {
        userId: playerId,
        giftCode: row.code,
        captchaId: captchaId,
        captcha: captcha,
      }).catch(() => {});
      if (!resp || !resp.data) {
        return await interaction.editReply({ content: interaction.__('A problem occured when trying to redeem your gift-code. Please try again later.') });
      }
      // print(resp.status, resp.data)


// 0 === e ? this.newArr[0][20] //Congratulations! Your rewards have been sent to your in-game Mailbox. Go and check it out!
// 20001 === e ? this.newArr[0][37] //Redeem failed; information incorrect
// 20002 === e ? this.newArr[0][38] //Redeem failed; incorrect Verification Code
// 20003 === e ? this.newArr[0][21] //Oh no, we suspect your ID is incorrect. Please check again.
// 20401 === e ? this.newArr[0][22] //Oh no, we suspect your Rewards Code is incorrect. Please check again.
// 20402 === e ? this.newArr[0][23] //Oh no, your Rewards Code has already been used
// 20403 === e ? this.newArr[0][24] //Oh no, your Rewards Code has expired...
// 20404 === e ? this.newArr[0][44] 
// 20409 === e ? this.newArr[0][46]
// 30001 === e ? this.newArr[0][39] //Server is busy, please try again.

      // resp.data.code = 0
      switch (resp.data.code) {
        case 0: //Success!
          break;
        case 20402: //Already claimed code
        {
          print(`User has already claimed '${row.code}' or very unlikely bad code`)
          let channel = client.channels.cache.get(config.logChannel);
          if (channel) {
            channel.send({
              content: `[FAIL] Discord: ${interaction.member} \`${interaction.user.username}#${interaction.user.discriminator} ${interaction.user.id}\` PlayerID: \`${playerId}\` Locale: \`${interaction.locale}\` - already claimed this month? <@523114942434639873>`
            })
          }
          return await interaction.editReply({ content: interaction.__('Something went wrong... Have you already received a reward this month?'), ephemeral: true });
          // return await presentCaptcha(interaction, playerId);
        }
        case 20401: //Bad code
        case 20403: //Expired code
        case 20404: //Redeem code is expired
        case 20409: //This redemption code has already been redeemed and can no longer be redeemed
        {
          print(`Found invalid code '${row.code}'. Marking as used.`)
          let channel = client.channels.cache.get(config.logChannel);
          if (channel) {
            channel.send({
              content: `[FAIL] Invalid(used/expired?) code \`${row.code}\` ${resp.data.code}`,
            })
          }
          db.run(`UPDATE ${table} SET used=TRUE WHERE code = ?`, [row.code], () => {});
        }
        case 30001: //Server is busy
        case 20002: //Invalid captcha
          return await presentCaptcha(interaction, playerId);
        case 20003: //Invalid playerId
        {
          let channel = client.channels.cache.get(config.logChannel);
          if (channel) {
            channel.send({
              content: `[FAIL] Bad player id entered - Discord: ${interaction.member} \`${interaction.user.username}#${interaction.user.discriminator} ${interaction.user.id}\` PlayerID: \`${playerId}\` Locale: \`${interaction.locale}\``,
            })
          }
          return await interaction.editReply({ content: interaction.__('Invalid PlayerID \`%s\`. Please check again.', playerId), ephemeral: true });
        }
        default:
          return print("Unknown unhandled error code!", resp.data)
      }


      db.run(`UPDATE ${table} SET used=TRUE WHERE code = ?`, [row.code], () => {});
      db.run(`INSERT INTO players(discordid, playerid, code, date) VALUES(?, ?, ?, ?)`, [interaction.user.id, playerId, row.code, moment().unix() * 1000], () => {});

      print(`Redeem success Discord: ${interaction.user.username}#${interaction.user.discriminator} ${interaction.user.id} PlayerID: ${playerId} Code: ${row.code} Locale: ${interaction.locale}`)
      let channel = client.channels.cache.get(config.logChannel);
      if (channel) {
        channel.send({
          content: `[REDEEM] Discord: ${interaction.member} \`${interaction.user.username}#${interaction.user.discriminator}\` \`${interaction.user.id}\` PlayerID: \`${playerId}\` Code: \`${row.code}\` Locale: \`${interaction.locale}\``,
        })
      }

      return await interaction.editReply({ content: interaction.__('Congratulations! Your rewards have been sent to your in-game Mailbox. Go and check it out!'), ephemeral: true });
    }
  }
});


client.on("messageCreate", async message => {
  if (message.guild) return;
  if (!config.isDeveloper(message.author.id)) return;
  // print(message)


  switch (message.content) {
    case "help":
      message.reply(`Available commands:
- \`reset\` : Deletes all current codes. Use before adding new codes for the next month.
- \`codes\` : Use when uploading a text file with new **normal** codes
- \`nitro\` : Use when uploading a text file with new **nitro** codes
- \`backup\` : Backup a copy of the database
`);
      break;
    case "codes":
    case "nitro":
      if (!message.attachments || !message.attachments.size) {
        return await message.reply("No attachement. Upload a text file with the codes with this command.")
      }
      message.attachments.forEach(async (attachement, key) => {
        let codes = await axios.get(attachement.url).catch(() => {});

        let table = message.content == 'nitro' ? 'nitro_codes': 'codes';
        const stmt = bs.prepare(`INSERT INTO ${table} (code) VALUES (?)`);
        bs.transaction(() => {
            codes.data.split(/\r?\n/).forEach(line =>  {
                line = line.trim()
                if (line.length) {
                  try {
                    stmt.run(line);
                  } catch (error) {}
                }
            });
        })()
      });
      message.reply("Inserting codes! Check /status")
      break;
    case "reset":
      await message.reply({content: "Clearing DB of used codes! Check /status", files: [new AttachmentBuilder('database.sqlite')]});
      db.run(`DELETE FROM nitro_codes`, [], () => {});
      db.run(`DELETE FROM codes`, [], () => {});
      break;
    case "backup":
      await message.reply({content: "Here you go :)", files: [new AttachmentBuilder('database.sqlite')]});
      break;
    default:
      message.reply("Unknown command. Try `help`");
      break;
  }
});

process.on('uncaughtException', async function (err) {
  if (err.name == 'DiscordAPIError[10062]') {
    print("Unknown interaction :(")
    return
  }
  if (err.name == 'ConnectTimeoutError') {
    print("captcha timeout :(")
    return
  }
  print(err);

  try {
    let reformed = await client.users.createDM('638290398665768961');
    if (reformed) {
      reformed.send(`\`\`\`${err.name}\n${err.stack}\`\`\``)
    }
  } catch (error) {}
});

if (config.token) {
  client.login(config.token);
}
