# Yentopia

Yentopia is a Discord bot that converts money between currencies. It is meant for servers where people use different currencies, like MYR, USD, SGD, and JPY.

You can use a slash command or the `cy!` prefix. Yentopia asks [Frankfurter](https://www.frankfurter.dev/) for a daily reference rate, does the math, and replies in Discord.

## Features

- Convert an amount from one currency to another
- Look up the exchange rate between two currencies
- Browse the currencies Frankfurter supports
- Autocomplete currency codes and names while you type
- Remember rates in memory so repeat questions do not hit the API
- Friendly errors when input or the API fails
- Discord slash commands, registered for every server the bot is invited to
- Prefix commands that start with `cy!`

## Commands

| Command | What it does | Slash example | Prefix example |
| --- | --- | --- | --- |
| convert | Converts an amount | `/convert from:MYR to:USD amount:100` | `cy!convert MYR USD 100` |
| rate | Shows the rate only | `/rate from:SGD to:JPY` | `cy!rate SGD JPY` |
| currency | Lists currencies, or searches by code or name | `/currency search:MY` | `cy!currency MY` |
| about | Explains Yentopia and the rate disclaimer | `/about` | `cy!about` |
| help | Shows the commands and examples | `/help` | `cy!help` |

`from` and `to` on slash commands suggest currencies as you type. You can search by code (`myr`) or by name (`ringgit`). Codes are not case-sensitive. The prefix is `cy!`, and `CY!convert` works too.

`/currency` and `cy!currency` list every supported currency. Add a search when you only want matches, like `/currency search:MY` or `cy!currency MY`, which can return `MYR — Malaysian Ringgit`. If nothing matches, the bot says it could not find that currency. Long lists still use Previous and Next buttons. `cy!currency 2` opens page 2 of the full list.

## Tech stack

| Piece | Role |
| --- | --- |
| Node.js 20+ | Runs the bot |
| TypeScript | The language the bot is written in |
| discord.js | Talks to Discord |
| Frankfurter API | Supplies exchange rates. No API key. |
| PM2 | Keeps the bot running on a server |
| Google Cloud VM | The intended place to host it |

Frankfurter does not have a conversion endpoint. Yentopia fetches one rate from `GET /v2/rate/{from}/{to}` and multiplies it by the amount.

## Setup

You need Node.js 20 or newer.

```bash
npm install
```

Copy the example env file and fill it in:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

| Variable | Required | Where to get it |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Discord Developer Portal → your app → Bot → Reset Token |
| `DISCORD_CLIENT_ID` | Yes | Discord Developer Portal → your app → OAuth2 → Client ID |

Slash commands are registered globally. After you invite the bot, those commands work in every server it joins. A new or updated slash command can take up to an hour to appear.

Prefix commands do not need a separate registration step. They work as soon as the bot is online in that server.

In the Bot tab of the Developer Portal, turn on **Message Content Intent**. `cy!` commands need it. If it is off, Discord will refuse the login.

Create a Discord application named Yentopia, add a bot, and invite it with the `bot` and `applications.commands` scopes. The invite below also asks for permission to view channels, send messages, embed links, and read message history, which the prefix replies need.

Invite URL (replace the client id):

```text
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=84992&scope=bot%20applications.commands
```

There is no Frankfurter API key. Do not add one.

## Development

```bash
npm run dev
```

This starts the bot with `tsx` and restarts it when you change a file. Register commands separately with the command below. Starting the bot does not register them.

## Build

```bash
npm run build
```

This compiles TypeScript into the `dist` folder.

## Register commands

```bash
npm run deploy-commands
```

This registers these slash commands for every server:

```text
/convert
/rate
/currency
/about
/help
```

`cy!` commands are built into the bot, so this script does not register them. Run it again after you change a slash command's name, description, or options. Global updates can take up to an hour.

## Tests

```bash
npm test
```

That runs the offline tests. They cover validation, formatting, caching, API error handling, and Discord reply behavior with fake data.

To also call the real Frankfurter API:

```bash
npm run test:live
```

## Production

On the Google Cloud VM, from this project folder:

```bash
npm install
npm run build
npm run deploy-commands
pm2 start ecosystem.config.cjs
pm2 save
```

PM2 reads `.env` through the app. Do not put the Discord token in `ecosystem.config.cjs`.

Useful follow-ups:

```bash
pm2 status
pm2 logs yentopia
pm2 restart yentopia
```

After you pull new code:

```bash
npm install
npm run build
pm2 restart yentopia
```

Run `npm run deploy-commands` again only when the slash commands themselves changed.

`pm2 save` remembers the process. `pm2 startup` can also bring it back after the VM reboots. Run the command PM2 prints and follow it once.

The bot shuts down on `SIGINT` and `SIGTERM`, which is what PM2 sends when it restarts the process.

## Exchange rate disclaimer

Frankfurter publishes reference exchange rates, mostly daily rates from central banks and other official sources. A bank, card, exchange, or payment app can charge a different rate. Yentopia is for quick conversions and information. It is not for trading or financial advice.

Rates are cached for 6 hours. The supported currency list is loaded when the bot starts and refreshed on a schedule. If Frankfurter is down at startup, the bot still logs in and tries again later.
