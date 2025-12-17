// City Pack model for versioned offline content

export interface CityPack {
  cityId: string;
  cityName: string;
  version: number;
  lastUpdated: string;
  landmarks: Record<string, CityPackLandmark>; // landmarkId -> landmark data
}

export interface CityPackLandmark {
  name: string;
  explanation: string;
  downloadedAt: string;
}

export interface CityPackManifest {
  cityId: string;
  cityName: string;
  latestVersion: number;
  totalLandmarks: number;
  description: string;
  releaseNotes?: string;
}

export interface CityPackStatus {
  cityId: string;
  isDownloaded: boolean;
  localVersion?: number;
  latestVersion?: number;
  isOutdated: boolean;
  downloadedAt?: string;
  landmarkCount: number;
}
