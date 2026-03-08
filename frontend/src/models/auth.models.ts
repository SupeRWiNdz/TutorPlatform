export interface LoginResponse {
  session_id: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  last_login?: string;
  is_student?: string;
  is_teacher?: string;
  is_parent?: string
}