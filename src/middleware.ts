import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This middleware function is currently a placeholder.
// The authentication logic is handled client-side in the AuthProvider.
// In a production scenario with server-side rendering, this middleware
// would inspect a session cookie or token to protect routes.

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
