export default function Loading() {
  return (
    <div className="container-x space-y-4 py-10" aria-busy="true">
      <div className="skeleton h-10 w-1/2" />
      <div className="skeleton h-64" />
    </div>
  );
}
