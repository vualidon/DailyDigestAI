import React, { createContext, useContext, useState, useEffect } from 'react';

interface PaperState {
  id: string;
  pdfContent: string;
  notes: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'suggestions';
    content: string;
    questions?: string[];
  }>;
}

interface PaperContextType {
  paperStates: { [key: string]: PaperState };
  updatePaperState: (paperId: string, state: Partial<PaperState>) => void;
  getPaperState: (paperId: string) => PaperState;
}

const PaperContext = createContext<PaperContextType | undefined>(undefined);

const STORAGE_KEY = 'paper_states';

export const PaperProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [paperStates, setPaperStates] = useState<{ [key: string]: PaperState }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paperStates));
  }, [paperStates]);

  const updatePaperState = (paperId: string, state: Partial<PaperState>) => {
    setPaperStates(prev => ({
      ...prev,
      [paperId]: {
        ...prev[paperId],
        ...state,
        id: paperId,
      },
    }));
  };

  const getPaperState = (paperId: string): PaperState => {
    return (
      paperStates[paperId] || {
        id: paperId,
        pdfContent: '',
        notes: '',
        messages: [],
      }
    );
  };

  return (
    <PaperContext.Provider value={{ paperStates, updatePaperState, getPaperState }}>
      {children}
    </PaperContext.Provider>
  );
};

export const usePaperContext = () => {
  const context = useContext(PaperContext);
  if (context === undefined) {
    throw new Error('usePaperContext must be used within a PaperProvider');
  }
  return context;
};