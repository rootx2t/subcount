require('dotenv').config();
const { Telegraf } = require('telegraf');
const db = require('./db');
const cron = require('node-cron');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID; // e.g. -1001234567890
const ADMIN_ID = process.env.ADMIN_ID;
const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES || '10', 10);

if (!BOT_TOKEN || !CHANNEL_ID || !ADMIN_ID) {
  console.error('Missing environment variables. Please set BOT_TOKEN, CHANNEL_ID, ADMIN_ID.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Utility: check admin
function isAdmin(ctx) {
  const from = ctx.from && String(ctx.from.id);
  return from === String(ADMIN_ID);
}

bot.start((ctx) => {
  ctx.reply('VIP subscription bot active. Admin-only commands: /addsub, /listsubs, /rmsub');
});

// /addsub <user_id> <days>
bot.command('addsub', async (ctx) => {
  try {
    if (!isAdmin(ctx)) return ctx.reply('Only admin can use this command.');
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) return ctx.reply('Usage: /addsub <user_id> <days>');
    const user_id = args[0];
    const days = parseInt(args[1], 10);
    if (isNaN(days) || days <= 0) return ctx.reply('Days must be a positive integer.');
    const until_ts = Math.floor(Date.now()/1000) + days*24*60*60;
    await db.set(user_id, until_ts);
    ctx.reply(`Subscription set for user ${user_id} for ${days} day(s). Expires at ${new Date(until_ts*1000).toISOString()}`);
  } catch (err) {
    console.error(err);
    ctx.reply('Error while adding subscription.');
  }
});

// /listsubs
bot.command('listsubs', async (ctx) => {
  try {
    if (!isAdmin(ctx)) return ctx.reply('Only admin can use this command.');
    const rows = await db.getAll();
    if (!rows || rows.length === 0) return ctx.reply('No subscriptions found.');
    let out = 'Subscriptions:\n';
    for (const r of rows) {
      out += `User: ${r.user_id} — Until: ${new Date(r.until_ts*1000).toISOString()}\n`;
    }
    ctx.reply(out);
  } catch (err) {
    console.error(err);
    ctx.reply('Error fetching subscriptions.');
  }
});

// /rmsub <user_id>
bot.command('rmsub', async (ctx) => {
  try {
    if (!isAdmin(ctx)) return ctx.reply('Only admin can use this command.');
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 1) return ctx.reply('Usage: /rmsub <user_id>');
    const user_id = args[0];
    await db.remove(user_id);
    ctx.reply(`Subscription removed for user ${user_id}`);
  } catch (err) {
    console.error(err);
    ctx.reply('Error removing subscription.');
  }
});

// Periodic checker: run every CHECK_INTERVAL_MINUTES
const cronExpr = `*/${Math.max(1, CHECK_INTERVAL_MINUTES)} * * * *`;
cron.schedule(cronExpr, async () => {
  try {
    console.log('Running subscription check at', new Date().toISOString());
    const rows = await db.getAll();
    const now = Math.floor(Date.now()/1000);
    for (const r of rows) {
      if (r.until_ts <= now) {
        // notify admin
        try {
          await bot.telegram.sendMessage(ADMIN_ID, `Subscription expired for user ${r.user_id}. Kicking from channel ${CHANNEL_ID}.`);
        } catch (e) {
          console.error('Failed to notify admin:', e);
        }

        // kick (ban) from channel, then unban so they can rejoin later if needed
        try {
          await bot.telegram.banChatMember(CHANNEL_ID, r.user_id);
          // unban after short delay to allow removal but not permanent ban
          setTimeout(async () => {
            try {
              await bot.telegram.unbanChatMember(CHANNEL_ID, r.user_id, {only_if_banned:true});
            } catch (e) {
              // older telegraf versions may not support options; attempt without options
              try {
                await bot.telegram.unbanChatMember(CHANNEL_ID, r.user_id);
              } catch (e2) {
                console.error('Unban failed:', e2);
              }
            }
          }, 5000);
        } catch (e) {
          console.error('Failed to kick user:', r.user_id, e);
        }

        // remove subscription from DB
        try {
          await db.remove(r.user_id);
        } catch (e) {
          console.error('Failed to remove subscription record:', e);
        }
      }
    }
  } catch (err) {
    console.error('Error in periodic check:', err);
  }
}, {
  scheduled: true
});

// start polling (if deployed on Render it should run as a web service; polling is fine)
bot.launch().then(() => {
  console.log('Bot launched');
});

// graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
