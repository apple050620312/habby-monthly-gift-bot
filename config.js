require('dotenv').config()

function isDeveloper(uid) {
    switch (uid) {
        case '523114942434639873': //sangege
        case '000000000000000000': //RandomAdmin
            return true;
        default:
            return false;
    }
}

module.exports = {
    isDeveloper: isDeveloper,
    guildId: process.env.GUILD,
    logChannel: process.env.LOG_CHANNEL,
    adminChannel: process.env.ADMIN_CHANNEL,
    clientId: process.env.CLIENT_ID,
    token: process.env.TOKEN,
    host: process.env.HOST,
    game: process.env.GAME,
};
