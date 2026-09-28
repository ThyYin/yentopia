import type { AutocompleteInteraction } from 'discord.js';
import { AUTOCOMPLETE_CHOICES } from '../config.js';
import type { CurrencyService } from '../services/currencyService.js';
import { currencyDisplayName } from '../utils/currencyFormatter.js';
import { respondToAutocomplete } from '../discord/respond.js';

export async function autocompleteCurrencies(
  interaction: AutocompleteInteraction,
  service: CurrencyService,
): Promise<void> {
  service.kickCurrencyRefresh();

  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'from' && focused.name !== 'to' && focused.name !== 'search') {
    await respondToAutocomplete(interaction, []);
    return;
  }

  const matches = service.searchCurrencies(String(focused.value), AUTOCOMPLETE_CHOICES);
  await respondToAutocomplete(
    interaction,
    matches.map((currency) => ({
      name: choiceName(currency.code, currencyDisplayName(currency.code, currency.name)),
      value: currency.code,
    })),
  );
}

function choiceName(code: string, name: string): string {
  const label = `${code} — ${name}`;
  return label.length <= 100 ? label : `${label.slice(0, 99)}…`;
}
