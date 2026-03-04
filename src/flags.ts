type FlagValue = boolean | number | string;

export type FlagValues = Record<string, FlagValue>;

const parseFlagValues = (raw: string | undefined): FlagValues => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as FlagValues;
  } catch (error) {
    console.warn("VITE_FLAG_VALUES must be a JSON object.", error);
    return {};
  }
};

const defaultFlagValues: FlagValues = {
  share_card_spin: true,
  share_card_interactive: true,
};

export const flagValues: FlagValues = {
  ...defaultFlagValues,
  ...parseFlagValues(import.meta.env.VITE_FLAG_VALUES),
};
