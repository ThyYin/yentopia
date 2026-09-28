# Yentopia — Discord Currency Converter Bot

## 1. Role

You are an autonomous senior TypeScript/Node.js developer.

Build the complete Discord bot described in this document from start to finish.

The bot is named **Yentopia**.

Do **not** ask me to approve individual phases, architecture decisions, file structures, dependencies, or implementation details. Make reasonable engineering decisions yourself and implement the entire project.

Do not stop after creating a scaffold or partial implementation. Continue until the bot is fully implemented, configured, tested, and ready to run.

If the repository already contains files, inspect them first and preserve anything that is relevant. Do not unnecessarily overwrite existing working code.

---

# 2. Project Goal

Yentopia is a Discord currency-conversion bot intended for use in a Discord server with international users.

Users should be able to perform currency conversions through Discord slash commands.

Primary use cases:

```text
/convert from:MYR to:USD amount:100
/convert from:USD to:MYR amount:25
/convert from:SGD to:JPY amount:100
/convert from:JPY to:MYR amount:10000
```

The bot should retrieve exchange-rate data from the **Frankfurter API**:

```text
https://api.frankfurter.dev/
```

Frankfurter does not require an API key.

Do not introduce a paid currency API unless absolutely necessary.

The bot should primarily use Frankfurter's daily reference exchange rates rather than attempting to provide real-time trading rates.

Clearly communicate this limitation to users through the bot's help/about information.

---

# 3. Required Technology Stack

Use:

* Node.js
* TypeScript
* discord.js v14+
* Frankfurter API
* Native `fetch` where practical
* npm
* Google Cloud VM for hosting
* PM2 for process management

Use modern TypeScript.

Target:

```text
Node.js >= 20
```

Do not use unnecessary frameworks or libraries.

Next.js is NOT required for the Discord bot itself.

If the repository already has a Next.js setup, do not remove it, but the Discord bot should remain a clean Node.js process.

---

# 4. Bot Identity

Bot name:

```text
Yentopia
```

Suggested description:

```text
A simple international currency converter for Discord.
```

Bot should use a clean and professional identity.

Do not use excessive emojis in every response.

Currency-related emojis are fine where useful.

---

# 5. Core Discord Command

Implement:

```text
/convert
```

Parameters:

```text
from
to
amount
```

Example:

```text
/convert from:MYR to:USD amount:100
```

Expected response:

```text
💱 Currency Conversion

100.00 MYR
≈ 23.45 USD

Exchange rate:
1 MYR = 0.2345 USD

Rate date: 2026-09-28

Source: Frankfurter
```

The exact converted value must come from the API response and calculation.

Do not hard-code exchange rates.

---

# 6. Currency Input

Users should enter standard ISO 4217 currency codes.

Examples:

```text
MYR
USD
SGD
JPY
EUR
GBP
AUD
CAD
CHF
CNY
HKD
KRW
THB
IDR
PHP
```

Input should be case-insensitive.

These should all work:

```text
MYR
myr
Myr
```

Normalise internally to uppercase:

```ts
const currency = input.trim().toUpperCase();
```

Validate that the currency is supported before making an API request.

Do not blindly send invalid user input to the API.

---

# 7. Currency List

Do not manually maintain a tiny hard-coded list containing only MYR/USD/SGD/JPY.

Yentopia should support the currencies available through Frankfurter.

Obtain the supported currency list from the appropriate Frankfurter endpoint and cache it.

If practical, initialise the supported-currency list when the bot starts.

The currency list should be refreshed periodically rather than requested from the API on every conversion.

If Frankfurter provides a currencies endpoint suitable for this purpose, use it.

The bot should gracefully handle the situation where the currencies endpoint is temporarily unavailable.

---

# 8. Amount Validation

The `amount` parameter must:

* Be numeric
* Be greater than 0
* Be finite
* Not be `NaN`
* Not be `Infinity`
* Not exceed a sensible maximum

Use a reasonable maximum such as:

```text
1,000,000,000,000
```

or another sensible value if there is a technical reason to choose differently.

Reject:

```text
0
-100
NaN
Infinity
abc
```

Return a friendly error message.

Example:

```text
❌ Invalid amount.

Please enter a number greater than 0.

Example:
/convert from:MYR to:USD amount:100
```

Do not crash the bot because of invalid input.

---

# 9. Same-Currency Conversion

Handle:

```text
/convert from:MYR to:MYR amount:100
```

without unnecessarily calling the API.

Return:

```text
💱 Currency Conversion

100.00 MYR
≈ 100.00 MYR

Exchange rate:
1 MYR = 1 MYR
```

This should be handled locally.

---

# 10. Frankfurter API

Use the current Frankfurter API v2 endpoints where appropriate.

For a specific conversion rate, use the appropriate rate endpoint, for example:

```text
GET https://api.frankfurter.dev/v2/rate/USD/JPY
```

Do not assume that an endpoint exists if it is not documented.

Inspect the current API documentation before finalising the implementation.

The implementation must correctly parse the API response.

Do not hard-code a response shape without checking the current Frankfurter API documentation.

---

# 11. API Abstraction

Do not put raw `fetch()` calls directly inside the Discord command handler.

Create a dedicated service such as:

```text
src/services/currencyService.ts
```

or an equivalent clean structure.

The service should handle:

* API requests
* API response parsing
* supported currency retrieval
* exchange-rate retrieval
* caching
* API errors
* timeouts
* retry behaviour where appropriate

The Discord command should only care about:

```text
input
→ currency service
→ result
→ Discord response
```

---

# 12. Caching

Do not call Frankfurter unnecessarily.

Implement an in-memory cache.

At minimum, cache:

1. Supported currencies
2. Exchange rates

Example conceptual cache:

```ts
Map<string, CachedRate>
```

where the key could be:

```text
USD:MYR
MYR:USD
SGD:JPY
```

Each cached item should contain:

```ts
{
    rate: number;
    date: string;
    fetchedAt: number;
}
```

Use a sensible TTL.

Because Frankfurter provides daily reference rates, a cache TTL of several hours is acceptable.

Prefer something such as:

```text
6 hours
```

or another sensible duration.

Do not make every Discord conversion generate a new API request.

---

# 13. Rate Fetching Strategy

When:

```text
MYR → USD
```

is requested:

1. Normalise currencies.
2. Validate currencies.
3. Check the cache.
4. If a valid cached rate exists, use it.
5. Otherwise request the rate from Frankfurter.
6. Validate the API response.
7. Cache the result.
8. Calculate the conversion.
9. Respond to Discord.

Do not cache invalid API responses.

---

# 14. API Timeout

Every external HTTP request must have a timeout.

Do not allow a broken Frankfurter request to hang indefinitely.

Use `AbortController` or an equivalent mechanism.

Use a reasonable timeout such as:

```text
10 seconds
```

If the request times out:

```text
❌ Currency service timed out.

Please try again in a moment.
```

Do not expose stack traces to Discord users.

---

# 15. API Error Handling

Gracefully handle:

* HTTP 400
* HTTP 404
* HTTP 429
* HTTP 500
* HTTP 502
* HTTP 503
* network failures
* timeout
* malformed JSON
* malformed API response
* missing rate
* unsupported currency

Example:

```text
❌ I couldn't retrieve the exchange rate right now.

Please try again shortly.
```

Log the actual technical error server-side.

Never expose:

* stack traces
* internal file paths
* environment variables
* secrets
* raw API errors that may reveal implementation details

to Discord users.

---

# 16. Discord Error Handling

Every slash-command execution should be wrapped with proper error handling.

The bot must never crash because:

* a user enters invalid input
* the API fails
* Discord responds unexpectedly
* a malformed API response is received

If an error occurs after a Discord interaction has already been deferred, use:

```ts
editReply()
```

rather than attempting another initial reply.

Correctly handle:

```ts
interaction.replied
interaction.deferred
```

---

# 17. Discord Response Design

Use Discord embeds where appropriate.

Suggested successful response:

```text
💱 Currency Conversion

100.00 MYR
≈ 23.45 USD

Exchange rate
1 MYR = 0.2345 USD

Rate date
28 September 2026

Source
Frankfurter
```

Keep responses compact.

Do not spam unnecessary information.

For errors, use concise messages.

---

# 18. Currency Formatting

Create a utility for formatting currency values.

Example:

```text
100 MYR
23.45 USD
10,000 JPY
1,234.56 USD
```

Use `Intl.NumberFormat` where appropriate.

Do not blindly assume that every currency uses two decimal places.

Currencies such as JPY should be formatted appropriately.

Consider using:

```ts
Intl.NumberFormat
```

with currency codes.

If there is a technical issue with `Intl.NumberFormat` for an unusual currency, gracefully fall back to sensible numeric formatting.

---

# 19. Currency Names and Symbols

Where practical, use JavaScript's internationalisation APIs to obtain display information.

For example:

```text
MYR → Malaysian Ringgit
USD → US Dollar
SGD → Singapore Dollar
JPY → Japanese Yen
```

Do not hard-code every currency's symbol unless necessary.

If a currency name/symbol cannot be determined, fall back to its ISO code.

---

# 20. Additional Commands

Implement the following useful commands.

## `/currencies`

Display supported currencies.

Example:

```text
/currencies
```

Response:

```text
💱 Supported Currencies

AUD — Australian Dollar
CAD — Canadian Dollar
CHF — Swiss Franc
EUR — Euro
GBP — Pound Sterling
JPY — Japanese Yen
MYR — Malaysian Ringgit
SGD — Singapore Dollar
USD — US Dollar

...and more.
```

Do not create an absurdly large Discord message.

If the list is long, paginate it or split it into multiple embeds/messages safely.

Prefer an autocomplete-based `/convert` interface if practical.

---

# 21. Currency Autocomplete

Implement Discord slash-command autocomplete for:

```text
from
to
```

When a user types:

```text
/convert from:
```

show matching currency codes and names.

Example:

```text
MYR — Malaysian Ringgit
USD — US Dollar
SGD — Singapore Dollar
JPY — Japanese Yen
```

Autocomplete should:

* be case-insensitive
* search both code and currency name
* return only a reasonable number of Discord autocomplete choices
* never make a slow external API request on every keystroke

Use the cached currency list.

If the currency list is temporarily unavailable, the command should still function where possible.

---

# 22. `/rate`

Implement an additional command:

```text
/rate from:MYR to:USD
```

This returns only the current exchange rate.

Example:

```text
💱 Exchange Rate

1 MYR = 0.2345 USD

Rate date: 28 September 2026
Source: Frankfurter
```

This should use the same currency service and cache as `/convert`.

Do not duplicate API logic.

---

# 23. `/about`

Implement:

```text
/about
```

Response should explain:

```text
Yentopia

A Discord currency converter for international servers.

Exchange-rate data:
Frankfurter

Rates are reference exchange rates and may not represent the exact rate offered by banks, cards, exchanges, or payment providers.

Yentopia is intended for informational/convenience use and not financial trading.
```

Keep this concise.

---

# 24. `/help`

Implement:

```text
/help
```

Show the available commands:

```text
💱 Yentopia Commands

/convert
Convert an amount between currencies.

/rate
Check the exchange rate between two currencies.

/currencies
View supported currencies.

/about
Learn about Yentopia.

/help
Show this help message.
```

Include examples.

---

# 25. Slash Command Deployment

Create a proper command deployment script.

For example:

```text
npm run deploy-commands
```

The deployment script should register:

```text
/convert
/rate
/currencies
/about
/help
```

Use Discord's official REST API / discord.js command registration approach.

Do not register commands every time the bot starts.

Use a separate deployment script.

---

# 26. Environment Variables

Create:

```text
.env.example
```

Include only values actually required.

Likely:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
```

If the implementation requires a Discord application ID separately, use:

```env
DISCORD_CLIENT_ID=
```

If guild-specific command deployment is used during development:

```env
DISCORD_GUILD_ID=
```

Do NOT add a Frankfurter API key because none is required.

---

# 27. Secrets

Never hard-code:

```text
DISCORD_TOKEN
DISCORD_CLIENT_ID
DISCORD_GUILD_ID
```

Do not commit `.env`.

Create/update `.gitignore`:

```text
.env
.env.*
!.env.example
node_modules/
dist/
logs/
```

Ensure no secret appears in:

* source code
* README
* error messages
* Git commits
* Discord responses

---

# 28. Project Structure

Use a clean structure similar to:

```text
yentopia/
│
├── src/
│   ├── commands/
│   │   ├── convert.ts
│   │   ├── rate.ts
│   │   ├── currencies.ts
│   │   ├── about.ts
│   │   └── help.ts
│   │
│   ├── services/
│   │   └── currencyService.ts
│   │
│   ├── utils/
│   │   ├── currencyFormatter.ts
│   │   └── errorHandler.ts
│   │
│   ├── types/
│   │   └── currency.ts
│   │
│   ├── config.ts
│   ├── deploy-commands.ts
│   └── index.ts
│
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── ...
```

You may modify this structure if there is a strong engineering reason.

Keep responsibilities separated.

---

# 29. TypeScript Requirements

Use strict TypeScript.

`tsconfig.json` should enable appropriate strictness, preferably:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

Avoid:

```ts
any
```

unless genuinely unavoidable.

Prefer proper interfaces/types for:

* API responses
* cached rates
* currencies
* command configuration
* service results

Validate external API data at runtime instead of trusting TypeScript types alone.

---

# 30. Security

Implement sensible security practices.

Requirements:

* No hard-coded secrets
* Validate all user input
* Validate external API responses
* Do not expose internal errors
* Add request timeouts
* Avoid unnecessary API calls
* Avoid excessive Discord API calls
* Do not execute arbitrary user input
* Do not construct shell commands from user input
* Do not use `eval`
* Do not use unsafe dynamic code execution

---

# 31. Rate Limiting / Abuse Protection

Yentopia is a Discord bot and should not be abused to hammer the external API.

Because exchange rates are cached, normal usage should already produce very few API requests.

Additionally, implement a lightweight in-memory user cooldown if appropriate.

For example:

```text
1 conversion request per user per second
```

Do not make the bot annoying to use.

The purpose is to prevent accidental command spam, not restrict normal usage.

If a user triggers the cooldown:

```text
⏳ Please wait a moment before requesting another conversion.
```

Avoid making API requests during cooldown.

---

# 32. API Efficiency

Do NOT do this:

```text
Discord request
→ API request
→ Discord response
```

for every command if a cached rate exists.

Instead:

```text
Discord request
→ cache
→ conversion
→ Discord response
```

Only fetch from Frankfurter when necessary.

---

# 33. Logging

Implement useful server-side logging.

Log:

* bot startup
* Discord login success
* command registration
* currency cache refresh
* rate cache misses
* API failures
* unexpected errors

Do not log:

* Discord tokens
* environment variables
* sensitive user information

Use readable log messages.

Example:

```text
[INFO] Yentopia logged in as Yentopia#1234
[INFO] Currency cache loaded: 30 currencies
[INFO] Fetching exchange rate: MYR → USD
[INFO] Cached exchange rate: MYR → USD
```

---

# 34. Health / Startup Behaviour

When the bot starts:

1. Validate required environment variables.
2. Initialise the currency service.
3. Attempt to load supported currencies.
4. Log whether currency data was loaded successfully.
5. Log into Discord.
6. Register event handlers.
7. Make the bot ready to accept commands.

If the currency API is temporarily unavailable during startup, the bot should NOT necessarily crash.

It should retry or continue starting where possible, then fetch currency information when needed.

---

# 35. Graceful Shutdown

Handle:

```text
SIGINT
SIGTERM
```

Gracefully shut down the Discord client.

Do not leave hanging HTTP operations if they can reasonably be aborted.

This is important because the bot will run under PM2 on Google Cloud.

---

# 36. Package Scripts

Create useful npm scripts.

At minimum:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "deploy-commands": "tsx src/deploy-commands.ts"
  }
}
```

Adjust as necessary.

Production should execute compiled JavaScript:

```text
npm run build
npm start
```

Do not depend on `tsx` for production unless there is a compelling reason.

---

# 37. PM2 Deployment

Prepare the project for Google Cloud VM deployment using PM2.

Provide a PM2 ecosystem file if useful:

```text
ecosystem.config.cjs
```

Example concept:

```js
module.exports = {
  apps: [
    {
      name: "yentopia",
      script: "./dist/index.js",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
```

Do not put secrets in the ecosystem file.

Document:

```bash
npm install
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

and how to restart/update the bot.

---

# 38. README

Create a complete `README.md`.

It should explain:

## Yentopia

What Yentopia is.

## Features

* Currency conversion
* Exchange-rate lookup
* Supported-currency list
* Autocomplete
* Rate caching
* Error handling
* Discord slash commands

## Commands

Document:

```text
/convert
/rate
/currencies
/about
/help
```

with examples.

## Tech Stack

Document:

```text
Node.js
TypeScript
discord.js
Frankfurter API
PM2
Google Cloud
```

## Setup

Explain:

```bash
npm install
```

Create `.env` from `.env.example`.

Explain the required Discord credentials.

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Register Commands

```bash
npm run deploy-commands
```

## Production

Explain PM2 deployment.

## Exchange Rate Disclaimer

Explain that Frankfurter provides reference exchange rates and that actual bank/card/payment-provider rates may differ.

---

# 39. Testing

Before considering the project complete, test the implementation.

At minimum verify:

### Valid conversions

```text
MYR → USD
USD → MYR
SGD → JPY
JPY → SGD
EUR → GBP
```

### Case handling

```text
myr
usd
jPy
```

### Invalid currencies

```text
XYZ
ABC
123
```

### Invalid amounts

```text
0
-1
abc
NaN
Infinity
```

### Same currency

```text
MYR → MYR
USD → USD
```

### API failures

Simulate or mock:

```text
timeout
HTTP 500
HTTP 429
invalid JSON
missing rate
```

### Cache behaviour

Verify that repeated requests use cached data instead of repeatedly hitting Frankfurter.

### Discord interaction behaviour

Verify:

* normal response
* deferred response
* error after defer
* autocomplete
* command registration

---

# 40. Code Quality

Keep the implementation clean.

Avoid:

* huge `index.ts`
* duplicated API logic
* duplicated validation
* magic numbers everywhere
* unnecessary dependencies
* unnecessary abstractions
* `any`
* callback spaghetti

Prefer:

```text
small modules
clear names
typed functions
centralised configuration
centralised API service
reusable utilities
```

---

# 41. Important API Design Decision

Do not create a database merely for currency rates.

Yentopia does not need PostgreSQL, MySQL, Supabase, Prisma, Redis, or another persistent database for the initial implementation.

In-memory caching is sufficient.

The bot is intended to be lightweight.

If the VM restarts, the cache can simply be rebuilt.

---

# 42. Future-Proofing

Structure the currency service so that the API provider can be replaced later.

For example:

```ts
interface ExchangeRateProvider {
    getCurrencies(): Promise<Currency[]>;
    getRate(from: string, to: string): Promise<ExchangeRate>;
}
```

Then have a Frankfurter implementation.

Do not over-engineer this into a massive dependency-injection framework.

The goal is simply to avoid tightly coupling the Discord commands directly to Frankfurter.

---

# 43. Important Behaviour

When a user runs:

```text
/convert from:MYR to:USD amount:100
```

the complete flow should be:

```text
1. Receive Discord interaction
2. Read parameters
3. Normalise currency codes
4. Validate amount
5. Validate currencies
6. Check whether currencies are identical
7. Check rate cache
8. If needed, request rate from Frankfurter
9. Validate API response
10. Cache rate
11. Calculate converted amount
12. Format result
13. Respond using Discord
14. Log relevant information
```

Do not perform unnecessary API calls.

---

# 44. User Experience

Yentopia should feel like a polished Discord utility rather than a developer demo.

Users should not need to understand:

* APIs
* exchange-rate endpoints
* caching
* HTTP errors
* internal implementation

Responses should be human-readable.

Good:

```text
❌ I couldn't find that currency.

Please use a valid ISO 4217 currency code, such as MYR, USD, SGD or JPY.
```

Bad:

```text
Error: AxiosError ECONNREFUSED
```

---

# 45. Do Not Implement

Do NOT add:

* cryptocurrency conversion
* financial trading
* investment advice
* payment processing
* user accounts
* a database
* web scraping
* browser automation
* unnecessary AI functionality
* unnecessary dashboard
* unnecessary authentication system

Keep Yentopia focused on currency conversion.

---

# 46. Final Verification

After implementation:

1. Inspect every generated source file.
2. Remove unused imports.
3. Remove unused dependencies.
4. Run TypeScript compilation.
5. Fix all TypeScript errors.
6. Verify npm scripts.
7. Verify environment-variable handling.
8. Verify Discord command registration.
9. Verify API integration.
10. Verify caching.
11. Verify error handling.
12. Verify README accuracy.
13. Verify `.gitignore`.
14. Ensure no secrets are present.
15. Ensure the project is production-ready for a Google Cloud VM.

Do not stop at the first successful compilation.

Actually review the implementation for runtime issues.

---

# 47. Final Output From the Agent

After you have completed the implementation, provide a concise summary containing:

### Created

List the major files/components created.

### Commands

List:

```text
/convert
/rate
/currencies
/about
/help
```

### Setup

Give the exact commands needed to:

```text
npm install
configure .env
deploy Discord commands
build
start
```

### Production

Give the exact PM2 commands needed to run Yentopia on the Google Cloud VM.

### Notes

Mention:

* Frankfurter is used as the exchange-rate provider.
* No Frankfurter API key is required.
* Rates are reference rates rather than guaranteed real-time bank/card rates.
* Rates are cached to minimise external API requests.

Do not ask me what to do next.

The implementation should already be complete.
