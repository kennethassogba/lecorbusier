export type Place = {
  id: string;
  name: string;
  arrondissement: string;
  lat: number;
  lng: number;
  image: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl?: string;
  context: string;
  referenceKind?: "aerial";
};
export type Style = { id: string; name: string; detail: string };
export type Proposal = {
  id: string;
  place_id: string;
  style_id: string;
  author: string;
  title: string;
  status: "queued" | "planning" | "generating" | "ready" | "failed";
  brief?: string;
  caption?: string;
  instructions?: string;
  image?: string;
  error?: string;
  created_at: number;
  published_at: number | null;
  votes: number;
  owned?: boolean;
  place?: Place;
  is_demo?: number;
  demo_votes?: number;
};
export type Config = {
  places: Place[];
  styles: Style[];
  generationAvailable: boolean;
};
export type Draft = {
  location?: Place;
  placeId: string;
  styleId: string;
  instructions: string;
  author: string;
  title: string;
};
