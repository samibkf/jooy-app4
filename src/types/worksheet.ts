export interface RegionData {
  id: string;
  document_id: string;
  user_id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  name: string;
  description: string[];
  created_at: string;
}

export interface RegionsModeMetadata {
  documentName: string;
  documentId: string;
  regions: RegionData[];
  drmProtectedPages: number[] | boolean;
}

export interface AutoModeGuidanceItem {
  title: string;
  description: string;
}

export interface AutoModePageData {
  page_number: number;
  page_description: string;
  guidance: AutoModeGuidanceItem[];
}

export interface AutoModeMetadata {
  mode: "auto";
  data: AutoModePageData[];
}

export type WorksheetMetadata = RegionsModeMetadata | AutoModeMetadata;

// Type guards to help distinguish between the two formats
export function isAutoModeMetadata(meta: WorksheetMetadata): meta is AutoModeMetadata {
  return 'mode' in meta && meta.mode === 'auto';
}

export function isRegionsModeMetadata(meta: WorksheetMetadata): meta is RegionsModeMetadata {
  return !('mode' in meta) || (meta as any).mode !== 'auto';
}