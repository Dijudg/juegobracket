export type Team = {
  id: string;
  nombre: string;
  codigo: string;
  grupo: string;
  escudo?: string;
};

export type Fixture = {
  id: string;
  fecha?: string;
  hora?: string;
  fase?: string;
  group?: string;
  jornada?: string;
  homeId?: string;
  awayId?: string;
  estadio?: string;
  locacion?: string;
};

export type GroupSelections = Record<
  string,
  {
    primero?: Team;
    segundo?: Team;
    tercero?: Team;
  }
>;

export type Match = {
  id: string;
  label: string;
  equipoA?: Team;
  equipoB?: Team;
  ganador?: Team;
  perdedor?: Team;
};

export type MatchSchedule = {
  fecha?: string;
  hora?: string;
  estadio?: string;
  locacion?: string;
  homeId?: string;
  awayId?: string;
};

export type Seeds = {
  firsts: Record<string, Team | undefined>;
  seconds: Record<string, Team | undefined>;
  thirds: Record<string, Team | undefined>;
};

export type PlayoffPickState = Record<string, string | undefined>;

export type SavedBracketMeta = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type BracketSavePayload = {
  version: number;
  selections: Record<
    string,
    {
      primeroId?: string;
      segundoId?: string;
      terceroId?: string;
    }
  >;
  bestThirdIds: string[];
  picks: Record<string, string | undefined>;
  intercontinentalPicks: PlayoffPickState;
  uefaPicks: PlayoffPickState;
  isLocked: boolean;
  shareCardUrl?: string;
  shareCardUpdatedAt?: string;
  sharedBy?: {
    name?: string;
    alias?: string;
    avatarUrl?: string;
    coverUrl?: string;
    userId?: string;
  };
};

export type PlayoffMatchData = {
  id: string;
  title: string;
  dateLabel?: string;
  locationLabel?: string;
  homeTeam?: Team;
  awayTeam?: Team;
  winnerCode?: string;
  highlightFinal?: boolean;
};

export type PlayoffKeyBlockData = {
  id: string;
  title: string;
  subtitle?: string;
  mapGroup?: string;
  matches: PlayoffMatchData[];
};
