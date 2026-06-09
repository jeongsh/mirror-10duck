import { redirect } from "next/navigation";

export default function CalendarEventDetailRedirectPage() {
  redirect("/events");
}
