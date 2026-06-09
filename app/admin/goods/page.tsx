import { redirect } from "next/navigation";

export default function AdminGoodsRedirectPage() {
  redirect("/admin/events");
}
