import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute =  createRouteMatcher(['/sign-up(.*)', '/sign-in(.*)', '/duplicate-session']);

export default clerkMiddleware(async (auth, req) => {
    /*if (!isPublicRoute(req)) {
        await auth.protect()
        console.log("Protected route")
    }*/
});

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        "/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"
    ]
}; 