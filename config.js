require('dotenv').config()

function isDeveloper(uid) {
    switch (uid) {
        case '638290398665768961': //Reformed
        case '523114942434639873': //sangege
        case '210191300966744064': //BarBot
        case '109969814604218368': //Kamenwati
            return true;
        default:
            return false;
    }
}

module.exports = {
    isDeveloper: isDeveloper,
    guildId: process.env.GUILD,
    logChannel: process.env.LOG_CHANNEL,
    clientId: process.env.CLIENT_ID,
    token: process.env.TOKEN,
    host: process.env.HOST,
    game: process.env.GAME,
};
