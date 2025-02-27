const { SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const config = require('./config.js')

let commands = [
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Checks bot status'),
    new SlashCommandBuilder()
        .setName('lookup')
        .setDescription('Looks up a playerid')
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Info about a discord user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('user')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('id')
                .setDescription('Info about a player id')
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('id')
                        .setRequired(true)))
        .setDMPermission(false),
    new SlashCommandBuilder()
        .setName('post')
        .setDescription('Post the gift button to a specific channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to post to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('label')
                .setDescription('The text of the button')
                .setRequired(true))
        .setDMPermission(false),
    new SlashCommandBuilder()
        .setName('code')
        .setDescription('Get code')
        .setDMPermission(false),
]
.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);
rest.put(Routes.applicationCommands(config.clientId), { body: commands })
    .then((data) => console.log(`Successfully registered ${data.length} application commands.`))
    .catch(console.error);



    
commands = [
    // new SlashCommandBuilder()
    //     .setName('captcha')
    //     .setDescription('Test captcha flow')
]
.map(command => command.toJSON());

rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands })
    .then((data) => console.log(`Successfully registered ${data.length} guild commands.`))
    .catch(console.error);
