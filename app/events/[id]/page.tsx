import EventDetailPage from "@/components/calendar/EventDetailPage";

export default function EventDetailPageRoute({ params }: { params: Promise<{ id: string }> }) {
  return <EventDetailPage params={params} kind="release" />;
}
