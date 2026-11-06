export type DirectoryKind = "gym" | "coach" | "doctor";

export type DirectoryListing = {
  id: string;
  kind: DirectoryKind;
  name: string;
  title: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  address: string;
  website?: string;
  profileUrl?: string;
  image?: string;
  communities: string[];
  summary?: string;
};

export type DirectoryListResponse = {
  listings: DirectoryListing[];
  truncated: boolean;
  find_a_doctor_enabled?: boolean;
};
