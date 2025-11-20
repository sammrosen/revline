'use client';

import { useState, FormEvent } from 'react';

interface EmailCaptureProps {
  buttonText?: string;
  placeholder?: string;
  listId?: string;
  className?: string;
  inline?: boolean;
}

export default function EmailCapture({
  buttonText = 'Subscribe',
  placeholder = 'Enter your email',
  listId,
  className = '',
  inline = true,
}: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          listId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message || 'Successfully subscribed!');
        setEmail('');
        
        // Reset success message after 5 seconds
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
        }, 5000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  const containerClass = inline 
    ? 'flex flex-col sm:flex-row gap-3 w-full max-w-md'
    : 'flex flex-col gap-3 w-full max-w-md';

  return (
    <div className={`${className}`}>
      <form onSubmit={handleSubmit} className={containerClass}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          disabled={status === 'loading'}
          className="flex-1 px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-8 py-4 bg-white text-black font-medium hover:bg-zinc-100 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-lg shadow-white/10 hover:shadow-white/20"
        >
          {status === 'loading' ? 'Subscribing...' : buttonText}
        </button>
      </form>
      
      {message && (
        <p 
          className={`mt-3 text-sm ${
            status === 'success' ? 'text-green-400' : 'text-red-400'
          }`}
          role="alert"
        >
          {message}
        </p>
      )}
    </div>
  );
}

