import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = ({ context }: LoaderFunctionArgs) => {
  if (context.isAuthenticated) {
    return redirect("/assets", { status: 302 });
  }

  return redirect("/login", { status: 302 });
};

// Prevent unnecessary revalidation of this simple redirect
export const shouldRevalidate = () => false;

export default function Route() {
  return null;
}
