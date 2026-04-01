import { useEffect, useState } from "react";

export default function PersoonlijkeOmgevingPage() {
  const [auth, setAuth] = useState<null | {
    authenticated: boolean;
    userId?: string;
  }>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        setAuth({
          authenticated: data?.authenticated,
          userId: data?.runtime?.userId,
        });
      })
      .catch(() => {
        setAuth({ authenticated: false });
      });
  }, []);

  if (auth === null) {
    return (
      <div className="p-6 text-white">
        Laden...
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div className="p-6 text-white">
        🔒 Je moet ingelogd zijn voor de persoonlijke omgeving
      </div>
    );
  }

  return <Home />;
}