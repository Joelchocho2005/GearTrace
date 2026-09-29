import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155'
          }
        }}/>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
