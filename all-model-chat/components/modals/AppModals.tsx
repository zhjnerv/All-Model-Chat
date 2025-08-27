import React from 'react';
import { SettingsModal } from '../SettingsModal';
import { LogViewer } from '../LogViewer';
import { PreloadedMessagesModal } from '../PreloadedMessagesModal';
import { ExportChatModal } from '../ExportChatModal';
import { AppModalsProps } from '../../types';
import { AVAILABLE_THEMES } from '../../constants/themeConstants';

export const AppModals: React.FC<AppModalsProps> = (props) => {
    const {
        isSettingsModalOpen, setIsSettingsModalOpen, appSettings, availableModels,
        handleSaveSettings, isModelsLoading, modelsLoadingError, clearCacheAndReload,
        clearAllHistory,
        handleInstallPwa, installPromptEvent, isStandalone, 
        handleImportSettings, handleExportSettings,
        handleImportHistory, handleExportHistory,
        handleImportAllScenarios, handleExportAllScenarios,
        isPreloadedMessagesModalOpen, setIsPreloadedMessagesModalOpen, savedScenarios,
        handleSaveAllScenarios, handleLoadPreloadedScenario,
        isExportModalOpen, setIsExportModalOpen, handleExportChat, exportStatus,
        isLogViewerOpen, setIsLogViewerOpen, currentChatSettings,
        t
    } = props;
    
    return (
        <>
          {isLogViewerOpen && (
            <LogViewer
                isOpen={isLogViewerOpen}
                onClose={() => setIsLogViewerOpen(false)}
                appSettings={appSettings}
                currentChatSettings={currentChatSettings}
            />
          )}
          {isSettingsModalOpen && (
            <SettingsModal
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              currentSettings={appSettings}
              availableModels={availableModels}
              availableThemes={AVAILABLE_THEMES}
              onSave={handleSaveSettings}
              isModelsLoading={isModelsLoading}
              modelsLoadingError={modelsLoadingError}
              onClearAllHistory={clearAllHistory}
              onClearCache={clearCacheAndReload}
              onOpenLogViewer={() => setIsLogViewerOpen(true)}
              onInstallPwa={handleInstallPwa}
              isInstallable={!!installPromptEvent && !isStandalone}
              onImportSettings={handleImportSettings}
              onExportSettings={handleExportSettings}
              onImportHistory={handleImportHistory}
              onExportHistory={handleExportHistory}
              onImportScenarios={handleImportAllScenarios}
              onExportScenarios={handleExportAllScenarios}
              t={t}
            />
          )}
          {isPreloadedMessagesModalOpen && (
            <PreloadedMessagesModal
              isOpen={isPreloadedMessagesModalOpen}
              onClose={() => setIsPreloadedMessagesModalOpen(false)}
              savedScenarios={savedScenarios}
              onSaveAllScenarios={handleSaveAllScenarios}
              onLoadScenario={handleLoadPreloadedScenario}
              t={t}
            />
          )}
          {isExportModalOpen && (
              <ExportChatModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onExport={handleExportChat}
                exportStatus={exportStatus}
                t={t}
              />
          )}
        </>
    );
}