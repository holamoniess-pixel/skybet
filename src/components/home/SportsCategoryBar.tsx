import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function SportsCategoryBar() {
  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 px-4 py-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-primary text-white shadow-sm shrink-0">
          <SportsSoccerIcon fontSize="small" />
          Football
        </button>
      </div>
    </div>
  );
}