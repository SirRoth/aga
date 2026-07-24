export type SlotStatus = "VACANT" | "ACTIVE" | "EXPIRED_GRACE";

export type CustomerSlot = {
  id: string;
  slot_name: string;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  allow_videos: boolean;
  status: SlotStatus;
  event_name: string | null;
  upload_slug: string | null;
  download_token: string | null;
  storage_prefix: string | null;
  event_start_at: string | null;
  created_at: string;
};

export type Photo = {
  id: string;
  slot_id: string;
  object_key: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_at: string;
};
