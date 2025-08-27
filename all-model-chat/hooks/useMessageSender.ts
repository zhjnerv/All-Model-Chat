import { useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { AppSettings, ChatMessage, UploadedFile, ChatSettings as IndividualChatSettings, ChatHistoryItem, SavedChatSession } from '../types';
import { generateUniqueId, buildContentParts, createChatHistoryForApi, getKeyForRequest, generateSessionTitle, logService } from '../utils/appUtils';
import { geminiServiceInstance } from '../services/geminiService';
import { DEFAULT_CHAT_SETTINGS } from '../constants/appConstants';
import { useChatStreamHandler } from './useChatStreamHandler';
import { useTtsImagenSender } from './useTtsImagenSender';

type SessionsUpdater = (updater: (prev: SavedChatSession[]) => SavedChatSession[]) => void;

interface MessageSenderProps {
    appSettings: AppSettings;
    messages: ChatMessage[];
    currentChatSettings: IndividualChatSettings;
    selectedFiles: UploadedFile[];
    setSelectedFiles: (files: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[])) => void;
    editingMessageId: string | null;
    setEditingMessageId: (id: string | null) => void;
    setAppFileError: (error: string | null) => void;
    aspectRatio: string;
    userScrolledUp: React.MutableRefObject<boolean>;
    activeSessionId: string | null;
    setActiveSessionId: (id: string | null) => void;
    activeJobs: React.MutableRefObject<Map<string, AbortController>>;
    setLoadingSessionIds: Dispatch<SetStateAction<Set<string>>>;
    updateAndPersistSessions: SessionsUpdater;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
}

export const useMessageSender = (props: MessageSenderProps) => {
    const {
        appSettings,
        currentChatSettings,
        messages,
        selectedFiles,
        setSelectedFiles,
        editingMessageId,
        setEditingMessageId,
        setAppFileError,
        aspectRatio,
        userScrolledUp,
        activeSessionId,
        setActiveSessionId,
        activeJobs,
        setLoadingSessionIds,
        updateAndPersistSessions,
        scrollContainerRef,
    } = props;

    const generationStartTimeRef = useRef<Date | null>(null);
    const { getStreamHandlers } = useChatStreamHandler(props);
    const { handleTtsImagenMessage } = useTtsImagenSender({ ...props, setActiveSessionId });

    const handleSendMessage = useCallback(async (overrideOptions?: { text?: string; files?: UploadedFile[]; editingId?: string }) => {
        const textToUse = overrideOptions?.text ?? '';
        const filesToUse = overrideOptions?.files ?? selectedFiles;
        const effectiveEditingId = overrideOptions?.editingId ?? editingMessageId;
        
        const sessionToUpdate = currentChatSettings;
        const activeModelId = sessionToUpdate.modelId;
        const isTtsModel = activeModelId.includes('-tts');
        const isImagenModel = activeModelId.includes('imagen');
        
        logService.info(`Sending message with model ${activeModelId}`, { textLength: textToUse.length, fileCount: filesToUse.length, editingId: effectiveEditingId, sessionId: activeSessionId });

        if (!textToUse.trim() && !isTtsModel && !isImagenModel && filesToUse.filter(f => f.uploadState === 'active').length === 0) return;
        if ((isTtsModel || isImagenModel) && !textToUse.trim()) return;
        if (filesToUse.some(f => f.isProcessing || (f.uploadState !== 'active' && !f.error) )) { 
            logService.warn("Send message blocked: files are still processing.");
            setAppFileError("Wait for files to finish processing."); 
            return; 
        }
        
        setAppFileError(null);

        if (!activeModelId) { 
            logService.error("Send message failed: No model selected.");
            const errorMsg: ChatMessage = { id: generateUniqueId(), role: 'error', content: 'No model selected.', timestamp: new Date() };
            const newSession: SavedChatSession = { id: generateUniqueId(), title: "Error", messages: [errorMsg], settings: { ...DEFAULT_CHAT_SETTINGS, ...appSettings }, timestamp: Date.now() };
            updateAndPersistSessions(p => [newSession, ...p]);
            setActiveSessionId(newSession.id);
            return; 
        }

        const keyResult = getKeyForRequest(appSettings, sessionToUpdate);
        if ('error' in keyResult) {
            logService.error("Send message failed: API Key not configured.");
             const errorMsg: ChatMessage = { id: generateUniqueId(), role: 'error', content: keyResult.error, timestamp: new Date() };
             const newSession: SavedChatSession = { id: generateUniqueId(), title: "API Key Error", messages: [errorMsg], settings: { ...DEFAULT_CHAT_SETTINGS, ...appSettings }, timestamp: Date.now() };
             updateAndPersistSessions(p => [newSession, ...p]);
             setActiveSessionId(newSession.id);
            return;
        }
        const { key: keyToUse, isNewKey } = keyResult;
        const shouldLockKey = isNewKey && filesToUse.some(f => f.fileUri && f.uploadState === 'active');

        const newAbortController = new AbortController();
        const generationId = generateUniqueId();
        generationStartTimeRef.current = new Date();
        
        if (appSettings.isAutoScrollOnSendEnabled) {
            userScrolledUp.current = false;
        }
        if (overrideOptions?.files === undefined) setSelectedFiles([]);

        if (isTtsModel || isImagenModel) {
            await handleTtsImagenMessage(keyToUse, activeSessionId, generationId, newAbortController, appSettings, sessionToUpdate, textToUse.trim(), aspectRatio, { shouldLockKey });
            return;
        }
        
        const successfullyProcessedFiles = filesToUse.filter(f => f.uploadState === 'active' && !f.error && !f.isProcessing);
        const { contentParts: promptParts, enrichedFiles } = await buildContentParts(textToUse.trim(), successfullyProcessedFiles);
        
        let finalSessionId = activeSessionId;

        // Perform a single, atomic state update for adding messages and creating a new session if necessary.
        if (!finalSessionId) { // New Chat
            const newSessionId = generateUniqueId();
            finalSessionId = newSessionId;
            let newSessionSettings = { ...DEFAULT_CHAT_SETTINGS, ...appSettings };
            if (shouldLockKey) newSessionSettings.lockedApiKey = keyToUse;
            
            const userMessage: ChatMessage = { id: generateUniqueId(), role: 'user', content: textToUse.trim(), files: enrichedFiles.length ? enrichedFiles.map(f => ({...f, rawFile: undefined})) : undefined, timestamp: new Date(), cumulativeTotalTokens: 0 };
            const modelMessage: ChatMessage = { id: generationId, role: 'model', content: '', timestamp: new Date(), isLoading: true, generationStartTime: generationStartTimeRef.current! };

            const newSession: SavedChatSession = { id: newSessionId, title: "New Chat", messages: [userMessage, modelMessage], timestamp: Date.now(), settings: newSessionSettings };
            updateAndPersistSessions(p => [newSession, ...p.filter(s => s.messages.length > 0)]);
            setActiveSessionId(newSessionId);
        } else { // Existing Chat or Edit
            updateAndPersistSessions(prev => prev.map(s => {
                const isSessionToUpdate = effectiveEditingId ? s.messages.some(m => m.id === effectiveEditingId) : s.id === finalSessionId;
                if (!isSessionToUpdate) return s;

                const editIndex = effectiveEditingId ? s.messages.findIndex(m => m.id === effectiveEditingId) : -1;
                const baseMessages = editIndex !== -1 ? s.messages.slice(0, editIndex) : [...s.messages];
                
                const lastCumulative = baseMessages.length > 0 ? (baseMessages[baseMessages.length - 1].cumulativeTotalTokens || 0) : 0;
                const userMessage: ChatMessage = { id: generateUniqueId(), role: 'user', content: textToUse.trim(), files: enrichedFiles.length ? enrichedFiles.map(f => ({...f, rawFile: undefined})) : undefined, timestamp: new Date(), cumulativeTotalTokens: lastCumulative };
                const modelMessage: ChatMessage = { id: generationId, role: 'model', content: '', timestamp: new Date(), isLoading: true, generationStartTime: generationStartTimeRef.current! };
                const newMessages = [...baseMessages, userMessage, modelMessage];

                let newTitle = s.title;
                if (s.title === 'New Chat' && !appSettings.isAutoTitleEnabled) {
                    newTitle = generateSessionTitle(newMessages);
                }
                let updatedSettings = s.settings;
                if (shouldLockKey && !s.settings.lockedApiKey) {
                    updatedSettings = { ...s.settings, lockedApiKey: keyToUse };
                }
                return { ...s, messages: newMessages, title: newTitle, settings: updatedSettings };
            }));
        }

        if (editingMessageId) {
            setEditingMessageId(null);
        }
        
        if (promptParts.length === 0) {
             setLoadingSessionIds(prev => { const next = new Set(prev); next.delete(finalSessionId!); return next; });
             activeJobs.current.delete(generationId);
             return; 
        }

        const baseMessagesForApi = editingMessageId ? messages.slice(0, messages.findIndex(m => m.id === editingMessageId)) : [...messages];
        const historyForApi = await createChatHistoryForApi(baseMessagesForApi);
        const fullHistory: ChatHistoryItem[] = [...historyForApi, { role: 'user', parts: promptParts }];
        
        const { streamOnError, streamOnComplete, streamOnPart, onThoughtChunk } = getStreamHandlers(finalSessionId!, generationId, newAbortController, generationStartTimeRef, sessionToUpdate);
        
        setLoadingSessionIds(prev => new Set(prev).add(finalSessionId!));
        activeJobs.current.set(generationId, newAbortController);

        if (appSettings.isStreamingEnabled) {
            await geminiServiceInstance.sendMessageStream(keyToUse, activeModelId, fullHistory, sessionToUpdate.systemInstruction, { temperature: sessionToUpdate.temperature, topP: sessionToUpdate.topP }, sessionToUpdate.showThoughts, sessionToUpdate.thinkingBudget, !!sessionToUpdate.isGoogleSearchEnabled, !!sessionToUpdate.isCodeExecutionEnabled, !!sessionToUpdate.isUrlContextEnabled, newAbortController.signal, streamOnPart, onThoughtChunk, streamOnError, streamOnComplete);
        } else { 
            await geminiServiceInstance.sendMessageNonStream(keyToUse, activeModelId, fullHistory, sessionToUpdate.systemInstruction, { temperature: sessionToUpdate.temperature, topP: sessionToUpdate.topP }, sessionToUpdate.showThoughts, sessionToUpdate.thinkingBudget, !!sessionToUpdate.isGoogleSearchEnabled, !!sessionToUpdate.isCodeExecutionEnabled, !!sessionToUpdate.isUrlContextEnabled, newAbortController.signal,
                streamOnError,
                (parts, thoughtsText, usageMetadata, groundingMetadata) => {
                    for(const part of parts) streamOnPart(part);
                    if(thoughtsText) onThoughtChunk(thoughtsText);
                    streamOnComplete(usageMetadata, groundingMetadata);
                }
            );
        }
    }, [
        appSettings,
        currentChatSettings,
        messages,
        selectedFiles,
        setSelectedFiles,
        editingMessageId,
        setEditingMessageId,
        setAppFileError,
        aspectRatio,
        userScrolledUp,
        activeSessionId,
        setActiveSessionId,
        activeJobs,
        setLoadingSessionIds,
        updateAndPersistSessions,
        getStreamHandlers,
        handleTtsImagenMessage,
        scrollContainerRef
    ]);

    return { handleSendMessage };
};
