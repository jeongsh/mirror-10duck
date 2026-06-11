export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-gray-400 bg-white/70 p-6 text-center text-sm leading-6 text-gray-500">
      {message}
    </div>
  );
}
