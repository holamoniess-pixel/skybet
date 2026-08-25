export function SkybetBrandMark() {
  return (
    <div className="flex items-center gap-2" aria-label="Skybet">
      <div className="grid size-9 place-items-center rounded-[14px] bg-[var(--sky-blue-700)] text-sm font-black tracking-[-0.08em] text-white shadow-[0_8px_18px_rgba(10,63,158,0.2)]">
        S
      </div>
      <span className="text-xl font-extrabold tracking-[-0.055em] text-[var(--sky-navy-950)] dark:text-white">
        sky<span className="text-[var(--sky-blue-600)]">bet</span>
      </span>
    </div>
  );
}
