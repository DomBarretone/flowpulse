export interface UserProfile {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'ANALYST';
  created_at: string;
  updated_at: string;
}

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export async function getCurrentUser(token: string | null): Promise<UserProfile | null> {
  if (!token) return null;

  try {
    const res = await fetch(`${getApiUrl()}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return (await res.json()) as UserProfile;
  } catch {
    return null;
  }
}
