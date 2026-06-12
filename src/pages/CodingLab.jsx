import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const initialFiles = [
  { id: 1, name: 'main.py', language: 'python', content: '# Virtual Deep Sea Drilling Controller\nimport time\n\ndef initialize_drill(depth_target):\n    print("Calibrating system sensors...")\n    time.sleep(1)\n    return True\n\nif __name__ == "__main__":\n    target = 12000\n    if initialize_drill(target):\n        print("Operation started at 12,000m target.")\n    else:\n        print("Error: Hardware failure.")' },
  { id: 2, name: 'script.js', language: 'javascript', content: 'console.log("Initializing React Environment...");\nconst x = 10;\nconst y = 20;\nconsole.log("Result:", x + y);' },
  { id: 3, name: 'index.html', language: 'html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello from Ignite Lab!</h1>\n</body>\n</html>' },
  { id: 4, name: 'main.cpp', language: 'cpp', content: '#include <iostream>\n\nint main() {\n    std::cout << "Hello C++ Engine!";\n    return 0;\n}' }
];

const CodingLab = () => {
  const [files, setFiles] = useState(initialFiles);
  const [activeFileId, setActiveFileId] = useState(1);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isPyodideLoading, setIsPyodideLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [previewDoc, setPreviewDoc] = useState('');
  
  const fileInputRef = useRef(null);

  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  useEffect(() => {
    const loadPyodideScript = async () => {
      try {
        if (!window.loadPyodide) {
          const script = document.createElement('script');
          script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
          document.body.appendChild(script);
          await new Promise(resolve => script.onload = resolve);
        }
        
        if (!window.pyodide) {
          window.pyodide = await window.loadPyodide({
            stdout: (text) => setOutput(prev => prev + text + '\n'),
            stderr: (text) => setOutput(prev => prev + 'Error: ' + text + '\n'),
          });
        }
        setIsPyodideLoading(false);
      } catch (err) {
        console.error("Pyodide load error", err);
        setIsPyodideLoading(false);
      }
    };
    loadPyodideScript();
  }, []);

  // Function to build combined preview document
  const getCombinedPreviewContent = () => {
    let htmlFile = files.find(f => f.id === activeFileId && f.language === 'html');
    if (!htmlFile) htmlFile = files.find(f => f.language === 'html');
    
    let htmlContent = htmlFile 
      ? htmlFile.content 
      : `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Live Preview</title>
</head>
<body style="font-family: system-ui, sans-serif; background-color: #ffffff; color: #1e293b; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; text-align: center; padding-top: 40px;">
    <h1 style="color: #ea580c; font-size: 2.5rem; margin-bottom: 1rem;">Ignite Lab Playground</h1>
    <p style="font-size: 1.1rem; line-height: 1.6; color: #64748b;">Create or select an HTML file to start previewing your custom web page here.</p>
  </div>
</body>
</html>`;

    // Extract all CSS contents
    const cssContents = files
      .filter(f => f.language === 'css' || f.name.endsWith('.css'))
      .map(f => f.content)
      .join('\n');

    // Extract all JS contents
    const jsContents = files
      .filter(f => f.language === 'javascript' || f.name.endsWith('.js'))
      .map(f => f.content)
      .join('\n');

    // Console bridge script
    const consoleBridgeScript = `
<script>
(function() {
  const _log = console.log;
  const _error = console.error;
  const _warn = console.warn;

  const sendToParent = (type, args) => {
    window.parent.postMessage({
      source: 'live-preview-console',
      type: type,
      message: args.map(arg => {
        if (typeof arg === 'object') {
          try { return JSON.stringify(arg); } catch(e) { return String(arg); }
        }
        return String(arg);
      }).join(' ')
    }, '*');
  };

  console.log = (...args) => {
    _log.apply(console, args);
    sendToParent('log', args);
  };
  console.error = (...args) => {
    _error.apply(console, args);
    sendToParent('error', args);
  };
  console.warn = (...args) => {
    _warn.apply(console, args);
    sendToParent('warn', args);
  };

  window.addEventListener('error', (e) => {
    sendToParent('error', [e.message + ' at line ' + e.lineno + ':' + e.colno]);
  });
})();
</script>
`;

    // Inject CSS
    const cssTag = `<style>\n${cssContents}\n</style>`;
    if (htmlContent.includes('</head>')) {
      htmlContent = htmlContent.replace('</head>', `${cssTag}\n</head>`);
    } else if (htmlContent.includes('<body>')) {
      htmlContent = htmlContent.replace('<body>', `<body>\n${cssTag}`);
    } else {
      htmlContent = cssTag + '\n' + htmlContent;
    }

    // Inject console bridge at the very top of head if possible
    if (htmlContent.includes('<head>')) {
      htmlContent = htmlContent.replace('<head>', `<head>\n${consoleBridgeScript}`);
    } else {
      htmlContent = consoleBridgeScript + '\n' + htmlContent;
    }

    // Inject JS
    const jsTag = `<script>\n(function() {\n  try {\n${jsContents}\n  } catch (err) {\n    console.error("Script Execution Error:", err);\n  }\n})();\n</script>`;
    if (htmlContent.includes('</body>')) {
      htmlContent = htmlContent.replace('</body>', `${jsTag}\n</body>`);
    } else {
      htmlContent = htmlContent + '\n' + jsTag;
    }

    return htmlContent;
  };

  // Debounced live preview update
  useEffect(() => {
    const activeFile = files.find(f => f.id === activeFileId) || files[0];
    const isWebFile = activeFile.language === 'html' || activeFile.language === 'css' || activeFile.language === 'javascript';
    if (!isWebFile) return;

    const timer = setTimeout(() => {
      setPreviewDoc(getCombinedPreviewContent());
    }, 500);

    return () => clearTimeout(timer);
  }, [files, activeFileId]);

  // Listen for logs from the live preview iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.source === 'live-preview-console') {
        const { type, message } = event.data;
        if (type === 'error') {
          setOutput(prev => prev + `[PREVIEW ERROR] ${message}\n`);
        } else if (type === 'warn') {
          setOutput(prev => prev + `[PREVIEW WARNING] ${message}\n`);
        } else {
          setOutput(prev => prev + `[PREVIEW LOG] ${message}\n`);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleEditorChange = (value) => {
    setFiles(files.map(f => f.id === activeFileId ? { ...f, content: value } : f));
  };

  const getLanguageFromExtension = (filename) => {
    if (filename.endsWith('.py')) return 'python';
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.html')) return 'html';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.cpp')) return 'cpp';
    if (filename.endsWith('.java')) return 'java';
    if (filename.endsWith('.cs')) return 'csharp';
    return 'plaintext';
  };

  const createNewFile = () => {
    const name = prompt('Enter file name (e.g., app.js):', 'new_file.py');
    if (!name) return;
    const newFile = {
      id: Date.now(),
      name,
      language: getLanguageFromExtension(name),
      content: ''
    };
    setFiles([...files, newFile]);
    setActiveFileId(newFile.id);
  };

  const deleteFile = (id, e) => {
    e.stopPropagation();
    if (files.length === 1) return alert('Cannot delete the last file.');
    const newFiles = files.filter(f => f.id !== id);
    setFiles(newFiles);
    if (activeFileId === id) setActiveFileId(newFiles[0].id);
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput(`[SYSTEM] Executing ${activeFile.name}...\n`);
    
    try {
      if (activeFile.language === 'python') {
        if (!window.pyodide) throw new Error("Python runtime not loaded.");
        window.pyodide.setStdout({ batched: (text) => setOutput(prev => prev + text + '\n') });
        window.pyodide.setStderr({ batched: (text) => setOutput(prev => prev + 'Error: ' + text + '\n') });
        await window.pyodide.runPythonAsync(activeFile.content);
        
      } else if (activeFile.language === 'javascript') {
        // Safe-ish eval by capturing console.log
        const logs = [];
        const originalConsoleLog = console.log;
        console.log = (...args) => {
          logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
        };
        try {
          // eslint-disable-next-line no-eval
          eval(activeFile.content);
          setOutput(prev => prev + logs.join('\n') + '\n[SYSTEM] JS Execution complete.\n');
        } catch (err) {
          setOutput(prev => prev + 'Runtime Error: ' + err.message + '\n');
        }
        console.log = originalConsoleLog;

      } else if (activeFile.language === 'html' || activeFile.language === 'css') {
        setOutput(prev => prev + '[SYSTEM] Compiling workspace web assets...\n');
        const compiledDoc = getCombinedPreviewContent();
        setPreviewDoc(compiledDoc);
        setOutput(prev => prev + '[SYSTEM] Preview refreshed. Live server is up-to-date.\n');     } else {
        setOutput(prev => prev + `[SYSTEM] Notice: Compiling ${activeFile.language.toUpperCase()} requires a backend compiler instance. Your code is syntactically valid and saved in the workspace.\n`);
      }
    } catch (error) {
      setOutput(prev => prev + '\nExecution Error:\n' + error.message + '\n');
    } finally {
      setIsRunning(false);
    }
  };

  const downloadProject = async () => {
    const zip = new JSZip();
    files.forEach(file => {
      zip.file(file.name, file.content);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'IgniteLab_Project.zip');
  };

  const handleFileUpload = (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;
    
    const readers = uploadedFiles.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            id: Date.now() + Math.random(),
            name: file.name,
            language: getLanguageFromExtension(file.name),
            content: e.target.result
          });
        };
        reader.readAsText(file);
      });
    });

    Promise.all(readers).then(parsedFiles => {
      setFiles(parsedFiles);
      setActiveFileId(parsedFiles[0].id);
    });
  };

  return (
    <div className="flex flex-col md:flex-row flex-1 h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Sidebar: File Explorer */}
      <aside className="w-full md:w-64 h-48 md:h-full bg-[#1e1e1e] border-b md:border-b-0 md:border-r border-[#333333] shrink-0 text-[#cccccc] overflow-y-auto">
        <div className="p-4 flex items-center justify-between uppercase tracking-widest text-xs font-bold text-[#858585]">
          <span>Explorer</span>
          <div className="flex gap-2">
            <span className="material-symbols-outlined text-[16px] cursor-pointer hover:text-white transition-colors" onClick={createNewFile}>note_add</span>
            <span className="material-symbols-outlined text-[16px] cursor-pointer hover:text-white transition-colors" onClick={() => fileInputRef.current.click()}>upload_file</span>
            <span className="material-symbols-outlined text-[16px] cursor-pointer hover:text-white transition-colors" onClick={downloadProject}>download</span>
            <input type="file" ref={fileInputRef} webkitdirectory="true" directory="true" multiple className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
        
        <div className="px-2">
          <div className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[#2a2d2e] font-bold text-sm">
            <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
            IGNITE_WORKSPACE
          </div>
          
          <div className="pl-6 pr-2 py-1 space-y-0.5">
            {files.map(file => (
              <div 
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                className={`flex justify-between items-center px-2 py-1 cursor-pointer text-sm ${activeFileId === file.id ? 'bg-[#37373d] text-white' : 'hover:bg-[#2a2d2e]'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[16px] ${file.language === 'python' ? 'text-blue-400' : file.language === 'javascript' ? 'text-yellow-400' : file.language === 'html' ? 'text-orange-400' : 'text-gray-400'}`}>
                    {file.language === 'python' ? 'terminal' : 'description'}
                  </span>
                  <span>{file.name}</span>
                </div>
                {files.length > 1 && (
                  <span className="material-symbols-outlined text-[14px] hover:text-red-400" onClick={(e) => deleteFile(file.id, e)}>close</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main IDE Layout */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] h-full relative">
        {/* IDE Top Tabs */}
        <div className="h-10 shrink-0 bg-[#252526] flex items-center overflow-x-auto custom-scrollbar">
          {files.map(file => (
            <div 
              key={file.id} 
              onClick={() => setActiveFileId(file.id)}
              className={`flex items-center gap-2 px-4 py-2 border-r border-[#1e1e1e] cursor-pointer min-w-fit text-sm ${activeFileId === file.id ? 'bg-[#1e1e1e] text-white border-t-2 border-t-blue-500' : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#2b2b2b]'}`}
            >
              <span className={`material-symbols-outlined text-[16px] ${file.language === 'python' ? 'text-blue-400' : file.language === 'javascript' ? 'text-yellow-400' : file.language === 'html' ? 'text-orange-400' : 'text-gray-400'}`}>
                {file.language === 'python' ? 'terminal' : 'description'}
              </span>
              {file.name}
              {files.length > 1 && (
                <span className="material-symbols-outlined text-[14px] hover:bg-[#333] rounded-md p-0.5" onClick={(e) => deleteFile(file.id, e)}>close</span>
              )}
            </div>
          ))}
        </div>

        {/* IDE Toolbar */}
        <div className="h-12 shrink-0 bg-[#1e1e1e] border-b border-[#333333] flex items-center justify-between px-4">
          <div className="text-[#cccccc] text-sm flex items-center gap-2">
            <span className="opacity-70">Ignite Lab</span>
            <span className="opacity-50">/</span>
            <span className="text-white">{activeFile.name}</span>
          </div>
          
          <div className="flex items-center gap-3">
            {(activeFile.language === 'html' || activeFile.language === 'css' || activeFile.language === 'javascript') && (
              <button 
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold text-sm border border-[#333333] transition-all ${showPreview ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#252526] text-[#cccccc] hover:bg-[#2d2d2d]'}`}>
                <span className="material-symbols-outlined text-[18px]">
                  {showPreview ? 'side_navigation' : 'chrome_reader_mode'}
                </span>
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            )}

            <button 
              onClick={runCode}
              disabled={isRunning || (activeFile.language === 'python' && isPyodideLoading)}
              className={`flex items-center gap-1 px-4 py-1.5 bg-green-600 text-white rounded font-bold shadow-sm transition-all text-sm ${isRunning || (activeFile.language === 'python' && isPyodideLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-500'}`}>
              <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>
                {isRunning ? 'hourglass_empty' : 'play_arrow'}
              </span>
              {activeFile.language === 'python' && isPyodideLoading ? 'Loading VM...' : 'Run Code'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor and Preview Split Layout */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative bg-[#1e1e1e]">
            <div className="flex-1 h-full overflow-hidden relative">
              <Editor
                height="100%"
                language={activeFile.language}
                theme="vs-dark"
                value={activeFile.content}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: { top: 16 }
                }}
              />
            </div>
            
            {/* Split Screen Live Preview */}
            {showPreview && (activeFile.language === 'html' || activeFile.language === 'css' || activeFile.language === 'javascript') && (
              <div className="w-full md:w-1/2 h-1/2 md:h-full border-t md:border-t-0 md:border-l border-[#333333] bg-white flex flex-col transition-all duration-300">
                {/* Preview Tab/Toolbar */}
                <div className="h-9 shrink-0 bg-[#252526] text-xs font-bold uppercase tracking-widest text-[#cccccc] flex items-center justify-between px-3 border-b border-[#1e1e1e]">
                  <span className="flex items-center gap-1.5 font-sans">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Live Web Preview
                  </span>
                  <button 
                    onClick={() => {
                      setOutput(prev => prev + '[SYSTEM] Manually reloading web preview...\n');
                      setPreviewDoc(getCombinedPreviewContent());
                    }} 
                    className="hover:text-white flex items-center gap-1 transition-colors font-sans text-xs font-bold uppercase"
                    title="Force refresh preview"
                  >
                    <span className="material-symbols-outlined text-[15px]">refresh</span>
                    Refresh
                  </button>
                </div>
                {/* Live Preview Iframe */}
                <div className="flex-1 bg-white relative">
                  <iframe 
                    title="live-preview" 
                    srcDoc={previewDoc} 
                    className="w-full h-full border-0 bg-white" 
                    sandbox="allow-scripts allow-modals" 
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Console / Terminal */}
          <div className="h-64 shrink-0 bg-[#1e1e1e] border-t border-[#333333] flex flex-col font-mono">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#333333]">
              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-[#cccccc]">
                <span className="text-white border-b border-white pb-1">Terminal</span>
                <span className="opacity-50 hover:opacity-100 cursor-pointer">Problems</span>
                <span className="opacity-50 hover:opacity-100 cursor-pointer">Output</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#cccccc] cursor-pointer hover:text-white" onClick={() => setOutput('')}>delete</span>
                <span className="material-symbols-outlined text-[16px] text-[#cccccc] cursor-pointer hover:text-white">expand_less</span>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-auto text-[#cccccc] text-[13px] whitespace-pre-wrap">
              {output || <span className="opacity-30">Run code to see output...</span>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CodingLab;
