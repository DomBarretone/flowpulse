import { clerkMiddleware } from '@clerk/nextjs/server';
import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';

const clerk = clerkMiddleware();

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (req.nextUrl.pathname === '/health') {
    return NextResponse.next();
  }
  return clerk(req, event);
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
