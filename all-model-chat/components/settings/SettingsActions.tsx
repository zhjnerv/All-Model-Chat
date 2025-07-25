import React from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { getResponsiveValue } from '../../utils/appUtils';

interface SettingsActionsProps {
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  t: (key: string) => string;
}

export const SettingsActions: React.FC<SettingsActionsProps> = ({
  onSave,
  onCancel,
  onReset,
  t,
}) => {
  const actionButtonIconSize = getResponsiveValue(12, 14);
  const baseButtonClass = "px-3 sm:px-4 py-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--theme-bg-primary)] flex items-center justify-center gap-1.5 text-sm font-medium";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4 border-t border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] rounded-b-xl">
      {/* Left side: Reset Action */}
      <button
        onClick={onReset}
        type="button"
        className={`${baseButtonClass} w-full sm:w-auto border border-transparent text-[var(--theme-text-tertiary)] hover:bg-[var(--theme-bg-tertiary)] hover:text-[var(--theme-text-secondary)] focus:ring-[var(--theme-border-secondary)]`}
        aria-label="Reset settings to default"
      >
        <RotateCcw size={actionButtonIconSize} />
        <span>{t('settingsReset')}</span>
      </button>

      {/* Right side: Primary Actions */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          onClick={onCancel}
          type="button"
          className={`${baseButtonClass} flex-1 sm:flex-initial bg-transparent text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border-secondary)] focus:ring-[var(--theme-border-secondary)]`}
        >
          <span>{t('cancel')}</span>
        </button>
        <button
          onClick={onSave}
          type="button"
          className={`${baseButtonClass} flex-1 sm:flex-initial bg-[var(--theme-bg-accent)] hover:bg-[var(--theme-bg-accent-hover)] text-[var(--theme-text-accent)] focus:ring-[var(--theme-border-focus)] shadow-sm hover:shadow-md`}
        >
          <Save size={actionButtonIconSize} />
          <span>{t('save')}</span>
        </button>
      </div>
    </div>
  );
};