import { useAppStore } from '../../store';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';

export default function Toast() {
  const { toast, clearToast } = useAppStore();
  if (!toast) return null;

  const icons = {
    success: <CheckCircleIcon className="text-green-500" />,
    error: <ErrorIcon className="text-red-500" />,
    info: <InfoIcon className="text-blue-500" />,
  };

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  return (
    <div className="fixed top-20 right-4 z-[100] animate-slide-up">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${bgColors[toast.type]}`}>
        {icons[toast.type]}
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{toast.message}</span>
        <button onClick={clearToast} className="p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded">
          <CloseIcon fontSize="small" />
        </button>
      </div>
    </div>
  );
}
