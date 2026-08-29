export function SkybetBrandMark() {
  return (
    <div className="flex items-center gap-2.5" aria-label="SKYBET">
      <span className="grid size-10 place-items-center rounded-[15px] bg-[var(--sky-blue-700)] p-1.5 shadow-[0_8px_18px_rgba(10,63,158,0.2)] sm:size-11">
        <svg viewBox="0 0 48 48" role="img" aria-label="SKYBET crest" className="size-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 2 43 10v13c0 11.2-7.4 19.1-19 23C12.4 42.1 5 34.2 5 23V10L24 2Z" fill="#083A8C" stroke="#8ED8FF" strokeWidth="1.5" />
          <circle cx="24" cy="20" r="10.5" fill="#F8FAFC" stroke="#0B2D68" strokeWidth="1.5" />
          <path d="m24 10 3 5.3-3 3-3-3L24 10Zm-10 9.5 5.8 2.1 1.2 4.2-5.3 1.6A10.4 10.4 0 0 1 14 19.5Zm20 0a10.4 10.4 0 0 1-1.7 7.9L27 25.8l1.2-4.2 5.8-2.1ZM18.7 29.2l5.3-1.6 5.3 1.6A10.5 10.5 0 0 1 18.7 29.2Z" fill="#0E56C9" />
          <path d="M10 30.5 24 22l14 8.5-4.6 2.8L24 27.2l-9.4 5.9L10 30.5Z" fill="#17D978" />
          <path d="M24 27.2v13.7l-4.1-2.5V29.7L24 27.2Z" fill="#0B8F57" />
        </svg>
      </span>
      <span className="text-2xl font-extrabold tracking-[-0.045em] text-[var(--sky-navy-950)] dark:text-white sm:text-[1.7rem]">
        SKY<span className="text-[var(--sky-blue-600)]">BET</span>
      </span>
    </div>
  );
}
