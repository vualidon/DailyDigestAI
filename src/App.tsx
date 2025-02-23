import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { PaperList } from './components/PaperList';
import { ThemeToggle } from './components/ThemeToggle';
import { BeakerIcon } from '@heroicons/react/24/solid';
import { PaperProvider } from './context/PaperContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

function App() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider>
        <div className="min-h-screen bg-[#faf9f6] dark:bg-gradient-to-b dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500">
          <header className="bg-white/80 backdrop-blur-sm dark:bg-gray-900/50 border-b border-gray-100 dark:border-blue-900/20 transition-all duration-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <BeakerIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 dark:drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-500" />
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white dark:drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] tracking-tight flex items-center gap-2 transition-all duration-500">
                      Daily Digest AI
                      <div className="flex items-center gap-1 ml-2">
                      </div>
                    </h1>
                    <p className="mt-1 text-lg text-gray-600 dark:text-blue-200/80 transition-all duration-500">
                      Stay updated with the latest AI research papers
                    </p>
                  </div>
                </div>
                <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PaperList />
          </main>
        </div>
      </PaperProvider>
    </QueryClientProvider>
  );
}

export default App;