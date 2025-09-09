import React from 'react';
import { SquarePen, Trash2, Pin, PinOff, Download } from 'lucide-react';
import { SavedChatSession } from '../../types';
import { translations } from '../../utils/appUtils';

interface SessionItemMenuProps {
  session: SavedChatSession;
  menuRef: React.RefObject<HTMLDivElement>;
  onStartEdit: () => void;
  onTogglePin: () => void;
  onExport: () => void;
  onDelete: () => void;
  t: (key: keyof typeof translations, fallback?: string) => string;
}

export const SessionItemMenu: React.FC<SessionItemMenuProps> = ({ session, menuRef, onStartEdit, onTogglePin, onExport, onDelete, t }) => (
  <div ref={menuRef} className="absolute right-3 top-9 z-10 w-40 bg-[var(--theme-bg-primary)] border border-[var(--theme-border-secondary)] rounded-md shadow-lg py-1">
    <button onClick={onStartEdit} className="w-full text-left px-3 py-1.5 text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] flex items-center gap-2"><SquarePen size={14} /> <span>{t('edit')}</span></button>
    <button onClick={onTogglePin} className="w-full text-left px-3 py-1.5 text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] flex items-center gap-2">{session.isPinned ? <PinOff size={14} /> : <Pin size={14} />} <span>{session.isPinned ? t('history_unpin') : t('history_pin')}</span></button>
    <button onClick={onExport} disabled={session.messages.length === 0} className="w-full text-left px-3 py-1.5 text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title={session.messages.length === 0 ? t('chat_is_empty', 'Chat is empty') : t('export_chat', 'Export Chat')}><Download size={14} /> <span>{t('export_chat', 'Export Chat')}</span></button>
    <button onClick={onDelete} className="w-full text-left px-3 py-1.5 text-sm text-[var(--theme-icon-error)] hover:bg-[var(--theme-bg-danger)] hover:text-[var(--theme-text-danger)] flex items-center gap-2"><Trash2 size={14} /> <span>{t('delete')}</span></button>
  </div>
);
