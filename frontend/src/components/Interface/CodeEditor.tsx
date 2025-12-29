import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import '../../styles/Interface/CodeEditor.css';

// Type for the editor instance
type EditorInstance = any;

// Default React component template
const defaultCode = `// Sample Interactive React Component
// Use React.createElement instead of JSX syntax
// Available: React, useState, useEffect, useRef, useCallback, useMemo

const SampleComponent = () => {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  const [todos, setTodos] = useState([]);
  const [currentTodo, setCurrentTodo] = useState('');

  const handleIncrement = () => setCount(count + 1);
  const handleDecrement = () => setCount(count - 1);
  
  const handleAddTodo = () => {
    if (currentTodo.trim()) {
      setTodos([...todos, currentTodo]);
      setCurrentTodo('');
    }
  };
  
  const handleRemoveTodo = (index) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return React.createElement('div', {
    style: { 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: '#f5f5f5',
      borderRadius: '10px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }
  }, [
    // Title
    React.createElement('h1', {
      key: 'title',
      style: { textAlign: 'center', color: '#333', marginBottom: '30px' }
    }, '🚀 Sample Interactive Component'),
    
    // Greeting Section
    React.createElement('div', {
      key: 'greeting',
      style: { marginBottom: '30px', padding: '15px', backgroundColor: 'white', borderRadius: '5px' }
    }, [
      React.createElement('h3', { key: 'greeting-title' }, '👋 Greeting'),
      React.createElement('input', {
        key: 'name-input',
        type: 'text',
        placeholder: 'Enter your name',
        value: name,
        onChange: (e) => setName(e.target.value),
        style: {
          padding: '10px',
          fontSize: '16px',
          border: '1px solid #ddd',
          borderRadius: '5px',
          width: '100%',
          marginBottom: '10px',
          boxSizing: 'border-box'
        }
      }),
      name ? React.createElement('p', {
        key: 'greeting-text',
        style: { color: '#007bff', fontSize: '18px' }
      }, \`Hello, \${name}! 👋\`) : null
    ]),

    // Counter Section
    React.createElement('div', {
      key: 'counter',
      style: { marginBottom: '30px', padding: '15px', backgroundColor: 'white', borderRadius: '5px' }
    }, [
      React.createElement('h3', { key: 'counter-title' }, '🔢 Counter'),
      React.createElement('div', {
        key: 'counter-content',
        style: { textAlign: 'center' }
      }, [
        React.createElement('p', {
          key: 'count-display',
          style: { fontSize: '24px', margin: '10px 0' }
        }, ['Count: ', React.createElement('strong', { key: 'count-value' }, count)]),
        React.createElement('div', { key: 'buttons' }, [
          React.createElement('button', {
            key: 'decrement',
            onClick: handleDecrement,
            style: {
              marginRight: '10px',
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }
          }, '➖ Decrease'),
          React.createElement('button', {
            key: 'increment',
            onClick: handleIncrement,
            style: {
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }
          }, '➕ Increase')
        ])
      ])
    ]),

    // Todo List Section
    React.createElement('div', {
      key: 'todos',
      style: { padding: '15px', backgroundColor: 'white', borderRadius: '5px' }
    }, [
      React.createElement('h3', { key: 'todo-title' }, '📝 Todo List'),
      React.createElement('div', {
        key: 'todo-input',
        style: { display: 'flex', marginBottom: '15px' }
      }, [
        React.createElement('input', {
          key: 'todo-text',
          type: 'text',
          placeholder: 'Add a new todo',
          value: currentTodo,
          onChange: (e) => setCurrentTodo(e.target.value),
          onKeyPress: (e) => e.key === 'Enter' && handleAddTodo(),
          style: {
            flex: 1,
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '5px 0 0 5px'
          }
        }),
        React.createElement('button', {
          key: 'add-button',
          onClick: handleAddTodo,
          style: {
            padding: '10px 15px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '0 5px 5px 0',
            cursor: 'pointer'
          }
        }, 'Add')
      ]),
      
      todos.length === 0 ? 
        React.createElement('p', {
          key: 'empty-message',
          style: { color: '#666', fontStyle: 'italic' }
        }, 'No todos yet. Add one above!') :
        React.createElement('ul', {
          key: 'todo-list',
          style: { listStyle: 'none', padding: 0 }
        }, todos.map((todo, index) =>
          React.createElement('li', {
            key: \`todo-\${index}\`,
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px',
              marginBottom: '5px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #e9ecef',
              borderRadius: '5px'
            }
          }, [
            React.createElement('span', { key: 'todo-text' }, todo),
            React.createElement('button', {
              key: 'remove-button',
              onClick: () => handleRemoveTodo(index),
              style: {
                padding: '5px 10px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px'
              }
            }, '❌')
          ])
        )),
      React.createElement('p', {
        key: 'todo-count',
        style: { marginTop: '15px', color: '#666', fontSize: '14px' }
      }, \`Total todos: \${todos.length}\`)
    ])
  ]);
};`;

interface CodeEditorProps {
  initialCode?: string;
  viewMode?: 'code' | 'preview';
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  initialCode = defaultCode, 
  viewMode: externalViewMode = 'preview' 
}) => {
  const [code, setCode] = useState(initialCode);
  const [internalViewMode, setInternalViewMode] = useState<'code' | 'preview' | 'split'>('code');
  const [compiledComponent, setCompiledComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const editorRef = useRef<EditorInstance>(null);

  // Use external viewMode if provided, otherwise use internal
  const viewMode = externalViewMode;

  // Transform and render React component
  const compileAndRender = async () => {
    try {
      setIsRunning(true);
      setError(null);

      // Remove import statements and extract component code
      let processedCode = code;
      
      // Remove import statements
      processedCode = processedCode.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');
      
      // Remove export statements
      processedCode = processedCode.replace(/export\s+default\s+\w+;?\s*$/gm, '');
      
      // Clean up extra whitespace
      processedCode = processedCode.trim();

      // Create a function that returns the React component
      const componentFunction = new Function(
        'React',
        'useState',
        'useEffect',
        'useRef',
        'useCallback',
        'useMemo',
        `
        const { createElement, Fragment } = React;
        ${processedCode}
        return SampleComponent;
        `
      );

      const { useState, useEffect, useRef, useCallback, useMemo } = React;
      const CompiledComponent = componentFunction(
        React,
        useState,
        useEffect,
        useRef,
        useCallback,
        useMemo
      );

      setCompiledComponent(() => CompiledComponent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compilation error');
      setCompiledComponent(null);
    } finally {
      setIsRunning(false);
    }
  };

  // Auto-compile on code change with debounce
  useEffect(() => {
    const timeoutId = setTimeout(compileAndRender, 1000);
    return () => clearTimeout(timeoutId);
  }, [code]);

  // Initial compilation
  useEffect(() => {
    compileAndRender();
  }, []);

  const handleEditorDidMount = (editor: EditorInstance) => {
    editorRef.current = editor;
    
    // Configure editor
    editor.updateOptions({
      fontSize: 14,
      minimap: { enabled: false },
      wordWrap: 'on',
      automaticLayout: true,
    });
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
    }
  };

  const renderPreview = () => {
    if (error) {
      return (
        <div className="preview-error">
          <h3>Error</h3>
          <pre>{error}</pre>
        </div>
      );
    }

    if (isRunning) {
      return (
        <div className="preview-loading">
          <div className="loading-spinner"></div>
          <p>Compiling...</p>
        </div>
      );
    }

    if (compiledComponent) {
      const Component = compiledComponent;
      return (
        <div className="preview-content">
          <React.Suspense fallback={<div>Loading component...</div>}>
            <Component />
          </React.Suspense>
        </div>
      );
    }

    return <div className="preview-empty">No component to preview</div>;
  };

  return (
    <div className="code-editor-container">
      {/* Content Area */}
      <div className={`code-editor-content ${viewMode}`}>
        {/* Code Editor */}
        {viewMode === 'code' && (
          <div className="editor-panel">
            <Editor
              height="100%"
              defaultLanguage="typescript"
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              options={{
                selectOnLineNumbers: true,
                roundedSelection: false,
                readOnly: false,
                cursorStyle: 'line',
                automaticLayout: true,
                folding: true,
                lineNumbers: 'on',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
              }}
            />
          </div>
        )}

        {/* Preview Panel */}
        {viewMode === 'preview' && (
          <div className="preview-panel">
            <div className="preview-container">
              {renderPreview()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeEditor;