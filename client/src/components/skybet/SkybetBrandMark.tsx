export function SkybetBrandMark() {
  return (
    <div className="flex items-center gap-2.5" aria-label="SKYBET">
      <span className="grid size-10 place-items-center overflow-hidden rounded-[15px] bg-[var(--sky-blue-700)] shadow-[0_8px_18px_rgba(10,63,158,0.2)] sm:size-11">
        <img src="/manus-storage/skybet-brand-crest_119a73d2.png" alt="" className="size-full object-cover" />
      </span>
      <span className="text-2xl font-extrabold tracking-[-0.045em] text-[var(--sky-navy-950)] dark:text-white sm:text-[1.7rem]">
        SKY<span className="text-[var(--sky-blue-600)]">BET</span>
      </span>
    </div>
  );
}
