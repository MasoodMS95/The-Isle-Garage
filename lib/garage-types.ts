export type RecordState = 'Living' | 'Dead' | 'Unknown' | 'No dinosaur';
export type Server = {
  id: string;
  name: string;
  community: string;
  kind: string;
  favorite: boolean;
  state: RecordState;
  species: string;
  growth: number;
  code: string;
  photo: string;
  updated?: string;
};
export type Share = {
  id: string;
  title: string;
  selectedIds: string[];
  includeCodes: boolean;
  includePhotos: boolean;
  active: boolean;
  updatedAt: string;
  discordStatus: string;
};
export type PublicRecord = {
  server: string;
  kind: string;
  state: RecordState;
  species: string;
  growth: number;
  updatedAt: string | null;
  code?: string;
  photo?: string;
};
export type PublicShare = {
  id: string;
  title: string;
  records: PublicRecord[];
  updatedAt: string;
  revision: string;
  source: 'Manual website records';
};
