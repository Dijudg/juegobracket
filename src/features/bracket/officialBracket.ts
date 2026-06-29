export const ROUND_OF_32_BASE = [
  { id: "73", home: "A2", away: "B2" },
  { id: "74", home: "E1", away: "LKP_E1" },
  { id: "75", home: "F1", away: "C2" },
  { id: "76", home: "C1", away: "F2" },
  { id: "77", home: "I1", away: "LKP_I1" },
  { id: "78", home: "E2", away: "I2" },
  { id: "79", home: "A1", away: "LKP_A1" },
  { id: "80", home: "L1", away: "LKP_L1" },
  { id: "81", home: "D1", away: "LKP_D1" },
  { id: "82", home: "G1", away: "LKP_G1" },
  { id: "83", home: "K2", away: "L2" },
  { id: "84", home: "H1", away: "J2" },
  { id: "85", home: "B1", away: "LKP_B1" },
  { id: "86", home: "J1", away: "H2" },
  { id: "87", home: "K1", away: "LKP_K1" },
  { id: "88", home: "D2", away: "G2" },
] as const;

export const ROUND_OF_16_MAP = [
  { id: "r16-89", label: "89", a: "r32-74", b: "r32-77" },
  { id: "r16-90", label: "90", a: "r32-73", b: "r32-75" },
  { id: "r16-91", label: "91", a: "r32-76", b: "r32-78" },
  { id: "r16-92", label: "92", a: "r32-79", b: "r32-80" },
  { id: "r16-93", label: "93", a: "r32-83", b: "r32-84" },
  { id: "r16-94", label: "94", a: "r32-81", b: "r32-82" },
  { id: "r16-95", label: "95", a: "r32-86", b: "r32-88" },
  { id: "r16-96", label: "96", a: "r32-85", b: "r32-87" },
] as const;

export const QUARTER_FINAL_MAP = [
  { id: "qf-97", label: "97", a: "r16-89", b: "r16-90" },
  { id: "qf-98", label: "98", a: "r16-93", b: "r16-94" },
  { id: "qf-99", label: "99", a: "r16-91", b: "r16-92" },
  { id: "qf-100", label: "100", a: "r16-95", b: "r16-96" },
] as const;

export const SEMI_FINAL_MAP = [
  { id: "sf-101", label: "101", a: "qf-97", b: "qf-99" },
  { id: "sf-102", label: "102", a: "qf-98", b: "qf-100" },
] as const;

export const ROUND_OF_32_LEFT_DISPLAY_IDS = [
  "r32-74",
  "r32-77",
  "r32-73",
  "r32-75",
  "r32-76",
  "r32-78",
  "r32-79",
  "r32-80",
] as const;

export const ROUND_OF_32_RIGHT_DISPLAY_IDS = [
  "r32-83",
  "r32-84",
  "r32-81",
  "r32-82",
  "r32-86",
  "r32-88",
  "r32-85",
  "r32-87",
] as const;

export const ROUND_OF_16_LEFT_DISPLAY_IDS = ["r16-89", "r16-90", "r16-91", "r16-92"] as const;
export const ROUND_OF_16_RIGHT_DISPLAY_IDS = ["r16-93", "r16-94", "r16-95", "r16-96"] as const;
