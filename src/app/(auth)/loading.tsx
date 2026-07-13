export default function AuthLoading() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 animate-fadeIn">
        <div className="spinner" />
        <p className="text-sm text-primary-700/70 font-medium">
          Memuat...
        </p>
      </div>
    </div>
  );
}
