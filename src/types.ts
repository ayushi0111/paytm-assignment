export interface User {
  id: number;
  email: string;
  password_hash: string;
  api_key: string;
  created_at: string;
}

export interface UrlRecord {
  id: number;
  code: string;
  original_url: string;
  normalized_url: string;
  is_custom: number;
  owner_id: number;
  click_count: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string | null;
}
