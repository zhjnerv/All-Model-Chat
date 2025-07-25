import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, AlertTriangle, Download, Maximize, Repeat, X, ZoomIn, ZoomOut, RotateCw, FileCode2, Image as ImageIcon } from 'lucide-react';

declare var Viz: any;
declare var Panzoom: any;

interface GraphvizBlockProps {
  code: string;
}

export const GraphvizBlock: React.FC<GraphvizBlockProps> = ({ code }) => {
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [layout, setLayout] = useState<'LR' | 'TB'>('LR');
  const [isRenderingLayout, setIsRenderingLayout] = useState(false);
  const [isDownloading, setIsDownloading] = useState<'none' | 'png' | 'svg'>('none');

  const diagramContainerRef = useRef<HTMLDivElement>(null);
  const zoomContentRef = useRef<HTMLDivElement>(null);
  const vizInstanceRef = useRef<any>(null);
  const panzoomInstanceRef = useRef<any>(null);
  const wheelListenerRef = useRef<((e: WheelEvent) => void) | null>(null);

  useEffect(() => {
    // This effect handles the issue where a `transform` on an ancestor element
    // breaks `position: fixed` for the modal. We find the animated message
    // container and temporarily disable its animation (and thus its transform)
    // while the modal is open.
    const messageContainer = diagramContainerRef.current?.closest('.message-container-animate');
    if (messageContainer) {
      if (isModalOpen) {
        messageContainer.classList.remove('message-container-animate');
      } else {
        // Only re-add if it doesn't have it, to avoid re-triggering animation on every render
        if (!messageContainer.classList.contains('message-container-animate')) {
          messageContainer.classList.add('message-container-animate');
        }
      }
    }
  }, [isModalOpen]);
  
  const renderGraph = useCallback(async (currentLayout: 'LR' | 'TB') => {
    if (!vizInstanceRef.current) return;
    setIsRenderingLayout(true);
    setError('');

    try {
      let processedCode = code;
      const rankdirRegex = /rankdir\s*=\s*"(LR|TB)"/i;
      const graphAttrsRegex = /(\s*(?:di)?graph\s*.*?\[)([^\]]*)(\])/i;
      
      // Case 1: rankdir exists, replace it.
      if (rankdirRegex.test(processedCode)) {
          processedCode = processedCode.replace(rankdirRegex, `rankdir="${currentLayout}"`);
      } 
      // Case 2: graph [...] block exists, but no rankdir. Add it.
      else if (graphAttrsRegex.test(processedCode)) {
          processedCode = processedCode.replace(graphAttrsRegex, (match, p1, p2, p3) => {
              const attrs = p2.trim();
              const separator = attrs && !attrs.endsWith(',') ? ', ' : ' ';
              return `${p1}${attrs}${separator}rankdir="${currentLayout}"${p3}`;
          });
      }
      // Case 3: No graph [...] block exists. Add one.
      else {
          const digraphMatch = processedCode.match(/(\s*(?:di)?graph\s+[\w\d_"]*\s*\{)/i);
          if (digraphMatch) {
              processedCode = processedCode.replace(
                  digraphMatch[0],
                  `${digraphMatch[0]}\n  graph [rankdir="${currentLayout}"];`
              );
          }
      }
      
      const svgElement = await vizInstanceRef.current.renderSVGElement(processedCode);
      setSvgContent(svgElement.outerHTML);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to render Graphviz diagram.';
      setError(errorMessage.replace(/.*error:\s*/, ''));
      setSvgContent('');
    } finally {
      setIsRenderingLayout(false);
      setIsLoading(false);
    }
  }, [code]);

  useEffect(() => {
    let intervalId: number;
    if (typeof Viz === 'undefined') {
        intervalId = window.setInterval(() => {
            if (typeof Viz !== 'undefined') {
                clearInterval(intervalId);
                vizInstanceRef.current = new Viz({ worker: undefined });
                renderGraph(layout);
            }
        }, 100);
    } else {
        vizInstanceRef.current = new Viz({ worker: undefined });
        renderGraph(layout);
    }
    return () => clearInterval(intervalId);
  }, [renderGraph, layout]);

  const handleToggleLayout = () => {
    const newLayout = layout === 'LR' ? 'TB' : 'LR';
    setLayout(newLayout);
  };
  
  const handleDownload = (format: 'png' | 'svg') => {
    if (!svgContent || isDownloading !== 'none') return;
    
    if (format === 'svg') {
        setIsDownloading('svg');
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `graphviz-diagram-${Date.now()}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsDownloading('none');
        return;
    }

    // PNG Download
    setIsDownloading('png');
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    const img = new Image();
    img.onload = () => {
        const imgWidth = img.width;
        const imgHeight = img.height;
        if (imgWidth === 0 || imgHeight === 0) {
            setError("Diagram has zero dimensions, cannot export.");
            setIsDownloading('none');
            return;
        }
        const canvas = document.createElement('canvas');
        const padding = 20;
        const scale = 3;
        canvas.width = (imgWidth + padding * 2) * scale;
        canvas.height = (imgHeight + padding * 2) * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, padding * scale, padding * scale, imgWidth * scale, imgHeight * scale);
            const pngUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = `graphviz-diagram-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        setIsDownloading('none');
    };
    img.onerror = () => {
        setError("Failed to convert diagram to PNG.");
        setIsDownloading('none');
    };
    img.src = svgDataUrl;
  };

  const handleOpenModal = useCallback(() => setIsModalOpen(true), []);
  const handleCloseModal = useCallback(() => setIsModalOpen(false), []);

  useEffect(() => {
    const zoomContainer = zoomContentRef.current;

    if (isModalOpen && zoomContainer && svgContent) {
      zoomContainer.innerHTML = svgContent;
      const svgEl = zoomContainer.querySelector('svg');

      if (svgEl && typeof Panzoom !== 'undefined') {
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.maxWidth = 'none';
        svgEl.style.maxHeight = 'none';
        svgEl.style.cursor = 'grab';

        if (panzoomInstanceRef.current) {
          panzoomInstanceRef.current.destroy();
        }
        panzoomInstanceRef.current = Panzoom(svgEl, {
          maxZoom: 15,
          minZoom: 0.05,
          contain: "outside",
          canvas: true,
        });

        wheelListenerRef.current = panzoomInstanceRef.current.zoomWithWheel;
        zoomContainer.addEventListener('wheel', wheelListenerRef.current, { passive: false });
      }
    }

    return () => {
      if (panzoomInstanceRef.current) {
        if (zoomContainer && wheelListenerRef.current) {
            zoomContainer.removeEventListener('wheel', wheelListenerRef.current);
        }
        panzoomInstanceRef.current.destroy();
        panzoomInstanceRef.current = null;
      }
      if (zoomContainer) {
          zoomContainer.innerHTML = '';
      }
      wheelListenerRef.current = null;
    };
  }, [isModalOpen, svgContent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCloseModal(); };
    if (isModalOpen) {
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);
    } else {
        document.body.style.overflow = '';
    }
    return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, handleCloseModal]);


  const containerClasses = "p-4 my-2 border border-[var(--theme-border-secondary)] rounded-lg shadow-inner overflow-auto custom-scrollbar flex items-center justify-center min-h-[150px]";

  if (isLoading) return <div className={`${containerClasses} bg-[var(--theme-bg-tertiary)]`}><Loader2 size={24} className="animate-spin text-[var(--theme-text-link)]" /></div>;

  if (error) return (
      <div className={`${containerClasses} bg-red-900/20`}>
        <div className="text-center text-red-400">
            <AlertTriangle className="mx-auto mb-2" />
            <strong className="font-semibold">Graphviz Error</strong>
            <pre className="mt-1 text-xs text-left whitespace-pre-wrap">{error}</pre>
        </div>
      </div>
  );

  const controlButtonClasses = "p-2 bg-black/50 hover:bg-black/70 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm";

  return (
    <div className="relative group">
      <div 
        ref={diagramContainerRef} 
        className={`${containerClasses} bg-white cursor-pointer hover:shadow-lg transition-shadow`} 
        dangerouslySetInnerHTML={{ __html: svgContent }} 
        onClick={handleOpenModal}
      />
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
        <button onClick={handleOpenModal} className="code-block-utility-button rounded-md" title="Expand View"><Maximize size={14} /></button>
      </div>

      {isModalOpen && (
        <div 
            className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm"
            onClick={handleCloseModal}
            role="dialog" aria-modal="true" aria-labelledby="graphviz-modal-title"
        >
          <div ref={zoomContentRef} className="relative w-[97%] h-[97%] bg-white overflow-hidden rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}></div>
          
          <button onClick={handleCloseModal} className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors flex items-center justify-center" title="Close Fullscreen (Esc)" aria-label="Close Fullscreen"><X size={24} /></button>
          <h2 id="graphviz-modal-title" className="sr-only">Interactive Diagram View</h2>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/40 rounded-lg shadow-lg backdrop-blur-sm border border-white/10">
              <button onClick={(e) => { e.stopPropagation(); panzoomInstanceRef.current?.zoomOut(); }} className={controlButtonClasses} title="Zoom Out"><ZoomOut size={18} /></button>
              <button onClick={(e) => { e.stopPropagation(); panzoomInstanceRef.current?.reset(); }} className={controlButtonClasses} title="Reset View"><RotateCw size={18} /></button>
              <button onClick={(e) => { e.stopPropagation(); panzoomInstanceRef.current?.zoomIn(); }} className={controlButtonClasses} title="Zoom In"><ZoomIn size={18} /></button>
              
              <div className="w-px h-6 bg-white/20 mx-1"></div>

              <button onClick={(e) => { e.stopPropagation(); handleToggleLayout(); }} disabled={isRenderingLayout} className={controlButtonClasses} title={`Toggle Layout (Current: ${layout})`}>
                  {isRenderingLayout ? <Loader2 size={18} className="animate-spin"/> : <Repeat size={18} />}
              </button>
              
              <div className="w-px h-6 bg-white/20 mx-1"></div>

              <button onClick={(e) => { e.stopPropagation(); handleDownload('png'); }} disabled={isDownloading !== 'none'} className={controlButtonClasses} title="Download as PNG">
                  {isDownloading === 'png' ? <Loader2 size={18} className="animate-spin"/> : <ImageIcon size={18} />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDownload('svg'); }} disabled={isDownloading !== 'none'} className={controlButtonClasses} title="Download as SVG">
                  {isDownloading === 'svg' ? <Loader2 size={18} className="animate-spin"/> : <FileCode2 size={18} />}
              </button>
          </div>
        </div>
      )}
    </div>
  );
};
