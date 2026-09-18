import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * En omdirigering som BEHÅLLER sessionskakorna.
 *
 * Det här var buggen. supabase.auth.getUser() förnyar tokenen när den
 * håller på att gå ut och skriver de nya kakorna på svaret vi skickade
 * in. NextResponse.redirect() skapar ett HELT NYTT svar — utan dem. Den
 * förnyade tokenen kastades alltså bort på varje omdirigering, medan
 * den gamla refresh-tokenen redan var förbrukad.
 *
 * Följden blev en session som dog mitt i steget: besökaren skickades
 * runt mellan /login och /auth/callback utan att någonsin vara inloggad,
 * och utan att något sa ifrån. Kakorna måste följa med över.
 */
function omdirigera(url: URL, fran: NextResponse): NextResponse {
  const svar = NextResponse.redirect(url);
  for (const kaka of fran.cookies.getAll()) {
    svar.cookies.set(kaka);
  }
  return svar;
}

export async function proxy(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // "/content" star kvar som prefix: sidan /content finns inte langre,
  // men den skyddar /content/facebook. "/campaign" skyddar bade
  // /campaign-builder och /campaigns.
  const protectedRoutes = [
    "/dashboard", "/onboarding", "/campaign-builder", "/campaigns",
    "/content", "/company", "/history", "/produkttexter", "/innehall",
  ];
  const isProtected = protectedRoutes.some(r => request.nextUrl.pathname.startsWith(r));

  if (!user && isProtected) {
    return omdirigera(new URL("/login", request.url), supabaseResponse);
  }

  // Den som redan ar inloggad har inget pa inloggningssidan att gora och
  // skickas till /auth/callback, som avgor om det blir Idag eller
  // onboarding.
  //
  // Bara for en INLOGGAD besokare. Gar getUser() inte att lita pa - en
  // kaka som inte langre galler, en Supabase-vard som svarar med fel -
  // blir user null, och da ska formularet visas. Det ar ratt utfall: en
  // utloggad besokare ska aldrig skickas nagon annanstans fran /login.
  if (user && request.nextUrl.pathname === "/login") {
    return omdirigera(new URL("/auth/callback", request.url), supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
