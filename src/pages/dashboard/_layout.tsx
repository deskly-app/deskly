import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import DashboardSidebar from "@/components/DashBoardSideBar";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardLayout() {
  const { isLoggedIn, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate("/");
    }
  }, [isLoggedIn, loading, navigate]);

  if (loading || !isLoggedIn) {
    return null;
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground select-none">
      <DashboardSidebar />
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar pt-6 sm:pt-8 pb-16 px-4 sm:px-6 md:px-10 bg-background">
        <Outlet />
      </main>
    </div>
  );
}
