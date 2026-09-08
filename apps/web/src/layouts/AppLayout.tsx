import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    // h-screen + overflow-hidden (NOT min-h-screen) is required here: it constrains this container to
    // exactly the viewport height, which is what lets `main`'s overflow-y-auto below actually create its
    // own internal scrollbar. Without this, a page taller than the viewport made the whole document
    // scroll instead — and since Sidebar isn't fixed/sticky, it would scroll away with the page, leaving
    // blank space where it used to be. Do not change this back to min-h-screen.
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="w-full animate-fade-in px-6 py-8 lg:px-10 xl:px-14">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
