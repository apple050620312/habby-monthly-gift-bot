# Monthly Gift Bot for Habby Games

## About
Original developed by **Reformed(mayvary)**, but he deleted his Discord and GitHub account.

Maintaining by **sangege**, contact me through [Discord](https://discord.com/users/523114942434639873) or create an issue.

## Bot always said captcha failed / don't work?
Update the code to newest version by downloading main branch.

If after updated it still doesn't work, contact me to debug.

## Bot can't do reset or backup by using the command?
Setup admin channel in server and use admin commands there.

Server supports 100MB file limit for bot to upload database.

## .env
```
TOKEN: Create a Discord bot and get the token
CLIENT_ID: Copy the bot's Client ID
GUILD: Copy the guild's ID
LOG_CHANNEL: Bot will send redeem logs in this channel ID
ADMIN_CHANNEL: Can use admin level commands like DM the bot does in this channel ID
GAME: Fill in the game's name so bot will display the activity
HOST: For example Survivor.io is `mail.survivorio.com`, SOULS is `mail.soulssvc.com`
```

## Setup
```
cp example.env .env
npm install
npm start
```

## Admin Usage
1. DM bot `help` for command list.
2. Send `help` in configured admin channel for command list.
