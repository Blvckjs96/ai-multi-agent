import Editor from '@monaco-editor/react'

/**
 * Monaco-based code editor.
 * @param {{ value: string, onChange: (v: string) => void,
 *           language?: string, height?: string, readOnly?: boolean }} props
 */
export default function CodeEditor({
  value,
  onChange,
  language = 'python',
  height = '300px',
  readOnly = false,
}) {
  return (
    <div className="rounded-lg overflow-hidden border border-argo-border">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v ?? '')}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: { top: 12, bottom: 12 },
          fontFamily: 'var(--f-mono)',
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
        }}
      />
    </div>
  )
}
