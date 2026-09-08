export type RecordState = 'Living' | 'Dead' | 'Unknown' | 'No dinosaur';
export const stages = ['Juvie', 'Adolescent', 'Adult', 'Full grown'] as const;
export type GrowthStage = (typeof stages)[number];
export type GameAccount = { id: string; label: string };
export type Dinosaur = {
  state: RecordState;
  species: string;
  growth: number;
  growthMode?: 'percent' | 'stage' | 'unknown';
  growthStage?: GrowthStage | '';
  prime?: boolean;
  code: string;
  photo: string;
  updated?: string;
};
export type Server = Dinosaur & {
  id: string;
  name: string;
  community: string;
  kind: string;
  favorite: boolean;
  dinosaurs?: Record<string, Dinosaur>;
};
export type PublicRecord = Omit<Dinosaur, 'code' | 'photo' | 'updated'> & {
  server: string;
  kind: string;
  updatedAt: string | null;
  accountLabel?: string;
  code?: string;
};
export type GarageProfile = {
  id: string;
  visibility: 'private' | 'public';
  version: number;
  legacyLinksRevoked: boolean;
};
export type PublicShare = {
  accountLabels: string[];
  id: string;
  title: string;
  records: PublicRecord[];
  updatedAt: string;
  revision: string;
  source: 'Manual website records';
};
