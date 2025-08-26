# Telegram VIP Subscription Bot

**Purpose**: Tracks subscription end-dates for VIP users, reminds the admin when subscriptions expire, and automatically kicks expired users from a channel.

## Features
- Add subscriptions (`/addsub <user_id> <days>` - admin only)
- List subscriptions (`/listsubs` - admin only)
- Remove subscription (`/rm sub <user_id>` - admin only)
- Periodic checker that:
  - sends a reminder to the admin when a subscription has expired
  - kicks the user from the channel (ban -> unban) so they can't stay in the channel
- Uses SQLite for persistence

## Files
- `index.js` - main bot
- `db.js` - small sqlite helper
- `.env.example` - environment variables example
- `package.json`, `Procfile` (for Render), `README.md`

## Render.com setup
1. Create a new Web Service on Render.
2. Use Node 18+ and point to this repository.
3. Add environment variables in Render dashboard:
   - `BOT_TOKEN` (your bot token)
   - `CHANNEL_ID` (your channel id, e.g. -1001234567890)
   - `ADMIN_ID` (your Telegram id)
4. Set start command to `npm start`.
5. Deploy.

**Security note**: Do not commit your real bot token to a public repo. Use Render's environment variables.

## Quick local run
1. Copy `.env.example` to `.env` and fill values.
2. `npm install`
3. `npm start`

