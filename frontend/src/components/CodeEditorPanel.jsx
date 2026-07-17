import React, { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Trash2, Code2, Loader2, CheckCircle2, XCircle, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Language configs for Wandbox API ───────────────────────
const LANGUAGES = [
  {
    id: 'python',
    label: 'Python 3',
    wandboxCompiler: 'cpython-3.12.7',
    monacoLang: 'python',
    defaultCode: `# Python 3
def solution(nums):
    # Write your solution here
    return sorted(nums)

# Test
print(solution([3, 1, 4, 1, 5, 9, 2, 6]))
`,
  },
  {
    id: 'java',
    label: 'Java',
    wandboxCompiler: 'openjdk-jdk-21+35',
    monacoLang: 'java',
    defaultCode: `// Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Write your solution here
        int[] nums = {3, 1, 4, 1, 5, 9, 2, 6};
        Arrays.sort(nums);
        System.out.println(Arrays.toString(nums));
    }
}
`,
  },
  {
    id: 'cpp',
    label: 'C++',
    wandboxCompiler: 'gcc-13.2.0',
    monacoLang: 'cpp',
    defaultCode: `// C++
#include <bits/stdc++.h>
using namespace std;

int main() {
    // Write your solution here
    vector<int> nums = {3, 1, 4, 1, 5, 9, 2, 6};
    sort(nums.begin(), nums.end());
    for (int x : nums) cout << x << " ";
    cout << endl;
    return 0;
}
`,
  },
];

// ── Wandbox API executor (free, no API key) ─────────────────
const executeCode = async (language, code) => {
  const lang = LANGUAGES.find(l => l.id === language);
  if (!lang) throw new Error('Unknown language');

  const response = await fetch('https://wandbox.org/api/compile.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compiler: lang.wandboxCompiler,
      code,
      'compiler-option-raw': '',
      'runtime-option-raw': '',
      save: false,
    }),
  });

  if (!response.ok) throw new Error(`Wandbox API error: ${response.status}`);
  const data = await response.json();

  const exitCode = parseInt(data.status ?? '0', 10);
  return {
    stdout: data.program_output || '',
    stderr: data.program_error || '',
    exitCode,
    compile_output: data.compiler_error || '',
  };
};

// ─────────────────────────────────────────────────────────────
const CodeEditorPanel = ({ onCodeChange, remoteCode, remoteLanguage, isReadOnly = false }) => {
  const [language, setLanguage]       = useState('python');
  const [code, setCode]               = useState(LANGUAGES[0].defaultCode);
  const [running, setRunning]         = useState(false);
  const [output, setOutput]           = useState(null);
  const [editorReady, setEditorReady] = useState(false);
  const editorRef                     = useRef(null);
  const lastRemoteRef                 = useRef('');

  const currentLang = LANGUAGES.find(l => l.id === language);

  // ── Apply remote code updates ──────────────────────────────
  useEffect(() => {
    if (
      remoteCode !== undefined &&
      remoteCode !== null &&
      remoteCode !== lastRemoteRef.current &&
      remoteCode !== code
    ) {
      lastRemoteRef.current = remoteCode;
      setCode(remoteCode);
      if (remoteLanguage && remoteLanguage !== language) {
        setLanguage(remoteLanguage);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteCode, remoteLanguage]);

  // ── Handle local edits ────────────────────────────────────
  const handleCodeChange = useCallback((val) => {
    const newCode = val || '';
    setCode(newCode);
    if (onCodeChange) onCodeChange(newCode, language);
  }, [language, onCodeChange]);

  const handleLanguageChange = useCallback((newLang) => {
    const lang = LANGUAGES.find(l => l.id === newLang);
    setLanguage(newLang);
    setCode(lang.defaultCode);
    setOutput(null);
    if (onCodeChange) onCodeChange(lang.defaultCode, newLang);
  }, [onCodeChange]);

  // ── Run code ──────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    setRunning(true);
    setOutput(null);
    try {
      const result = await executeCode(language, code);
      setOutput(result);
    } catch (err) {
      setOutput({ stderr: err.message, stdout: '', exitCode: 1 });
    } finally {
      setRunning(false);
    }
  }, [language, code]);

  const handleReset = useCallback(() => {
    const lang = LANGUAGES.find(l => l.id === language);
    setCode(lang.defaultCode);
    setOutput(null);
    if (onCodeChange) onCodeChange(lang.defaultCode, language);
  }, [language, onCodeChange]);

  const hasError = output && (output.exitCode !== 0 || output.stderr || output.compile_output);
  const hasOutput = output && (output.stdout || output.stderr || output.compile_output);

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800 min-w-0">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-neon-400" />
          <span className="text-sm font-black text-white uppercase tracking-wider">Code Editor</span>
          {!isReadOnly && (
            <span className="text-[9px] font-bold text-cyber-400 bg-cyber-400/10 border border-cyber-400/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
              Live Sync
            </span>
          )}
          {isReadOnly && (
            <span className="text-[9px] font-bold text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full uppercase tracking-widest">
              Watching
            </span>
          )}
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={e => handleLanguageChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg focus:outline-none focus:border-neon-400/50 cursor-pointer"
          >
            {LANGUAGES.map(l => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Monaco Editor ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Editor
          height="100%"
          language={currentLang?.monacoLang || 'python'}
          value={code}
          onChange={handleCodeChange}
          onMount={(editor) => { editorRef.current = editor; setEditorReady(true); }}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 8,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            readOnly: isReadOnly,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            tabSize: language === 'python' ? 4 : 4,
          }}
        />
      </div>

      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/80 shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-500 hover:bg-cyber-400 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {running
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
              : <><Play className="w-3.5 h-3.5" /> Run</>
            }
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all"
            title="Reset to default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setOutput(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all"
            title="Clear output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {output && (
          <div className="flex items-center gap-1.5">
            {hasError
              ? <XCircle className="w-3.5 h-3.5 text-danger-400" />
              : <CheckCircle2 className="w-3.5 h-3.5 text-cyber-400" />
            }
            <span className={`text-[10px] font-bold uppercase tracking-widest ${hasError ? 'text-danger-400' : 'text-cyber-400'}`}>
              {hasError ? 'Error' : 'Success'}
            </span>
            <span className="text-[10px] text-slate-600 font-mono">exit {output.exitCode}</span>
          </div>
        )}
      </div>

      {/* ── Output Panel ───────────────────────────────────── */}
      <AnimatePresence>
        {hasOutput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 180, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-800 bg-slate-950 overflow-hidden shrink-0"
          >
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800/50 bg-slate-900/50">
              <Terminal className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Output</span>
            </div>
            <div className="h-[148px] overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed">
              {output.compile_output && (
                <div className="text-yellow-400 mb-2 whitespace-pre-wrap">
                  <span className="text-yellow-600 font-bold">COMPILE: </span>{output.compile_output}
                </div>
              )}
              {output.stdout && (
                <pre className="text-cyber-300 whitespace-pre-wrap">{output.stdout}</pre>
              )}
              {output.stderr && (
                <pre className="text-danger-400 whitespace-pre-wrap">{output.stderr}</pre>
              )}
              {!output.stdout && !output.stderr && !output.compile_output && (
                <span className="text-slate-600 italic">No output</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CodeEditorPanel;
