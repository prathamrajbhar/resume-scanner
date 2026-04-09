'use client';

import { useAuth } from '@/lib/auth-context';
import { GoogleLogin } from '@react-oauth/google';

export function Header() {
  const { user, loginWithGoogleToken, logout, loading } = useAuth();

  return (
    <header className="bg-blue-600 text-white p-4 shadow-md">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Resume Scanner</h1>
          <p className="text-blue-100 hidden md:block">AI-Powered Resume Screening & Ranking</p>
        </div>
        <div>
          {!loading && (
            user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {user.avatar_url && (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name}
                      className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                    />
                  )}
                  <span className="font-medium hidden sm:block">{user.full_name}</span>
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm bg-blue-700 hover:bg-blue-800 rounded transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={credentialResponse => {
                  if (credentialResponse.credential) {
                    loginWithGoogleToken(credentialResponse.credential);
                  }
                }}
                onError={() => {
                  console.error('Login Failed');
                }}
                shape="pill"
                theme="filled_blue"
              />
            )
          )}
        </div>
      </div>
    </header>
  );
}
