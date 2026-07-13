import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const protectedRoutes = ["/admin", "/petugas", "/dokter", "/pasien"];
const authRoute = "/login";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, supabase } = await updateSession(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // If user is logged in and trying to access /login, redirect to their dashboard
  if (pathname === authRoute && user) {
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userData) {
      const dashboardRoutes: Record<string, string> = {
        admin: "/admin",
        petugas: "/petugas",
        dokter: "/dokter",
        pasien: "/pasien",
      };

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = dashboardRoutes[userData.role] || "/pasien";
      return Response.redirect(redirectUrl);
    }
  }

  // Check protected routes
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = authRoute;
    return Response.redirect(redirectUrl);
  }

  // If user is logged in, check role-based access
  if (user && isProtectedRoute) {
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userData) {
      const allowedRoutes: Record<string, string[]> = {
        admin: ["/admin", "/profile"],
        petugas: ["/petugas", "/profile"],
        dokter: ["/dokter", "/profile"],
        pasien: ["/pasien", "/profile"],
      };

      const isAllowed = allowedRoutes[userData.role]?.some((route) =>
        pathname.startsWith(route)
      );

      if (!isAllowed) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = `/${userData.role}`;
        return Response.redirect(redirectUrl);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
