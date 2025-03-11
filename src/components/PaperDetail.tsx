import React, { useState, useRef, useEffect } from 'react';
import { Paper } from '../types';
import { Dialog, Tab } from '@headlessui/react';
import { XMarkIcon, ArrowTopRightOnSquareIcon, PaperAirplaneIcon, DocumentArrowDownIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { DocumentTextIcon, ChatBubbleLeftRightIcon, PencilSquareIcon, PhotoIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { generateSummary, chat, generateObsidianNote } from '../lib/ai';
import ReactMarkdown from 'react-markdown';
import { usePaperContext } from '../context/PaperContext';

interface PaperDetailProps {
  paper: Paper;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant' | 'suggestions';
  content: string;
  questions?: string[];
}

export const PaperDetail: React.FC<PaperDetailProps> = ({ paper, isOpen, onClose }) => {
  const tabs = [
    { name: 'Abstract', icon: DocumentTextIcon },
    { name: 'PDF', icon: PhotoIcon },
    { name: 'Discussion', icon: ChatBubbleLeftRightIcon },
    { name: 'Notes', icon: PencilSquareIcon },
  ];

  const [notes, setNotes] = useState('');
  const [pdfContent, setPdfContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const { getPaperState, updatePaperState } = usePaperContext();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved state when component mounts
  useEffect(() => {
    const paperState = getPaperState(paper.paper.id);
    if (paperState.pdfContent) {
      setPdfContent(paperState.pdfContent);
    }
    if (paperState.messages && paperState.messages.length > 0) {
      setMessages(paperState.messages as Message[]);
      setSummary(paperState.messages[0]?.content || '');
    }
    if (paperState.notes) {
      setNotes(paperState.notes);
    }
  }, [paper.paper.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [newMessage]);

  const handleKeyPress = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim() && !isChatLoading) {
        const userMessage = newMessage.trim();
        const newUserMessage: Message = { role: 'user', content: userMessage };
        const updatedMessages = [...messages, newUserMessage];
        setMessages(updatedMessages);
        updatePaperState(paper.paper.id, { messages: updatedMessages });
        setNewMessage('');
        setIsChatLoading(true);

        try {
          const response = await chat(
            paper.title,
            paper.paper.summary,
            pdfContent,
            userMessage
          );
          const assistantMessage: Message = { role: 'assistant', content: response };
          const finalMessages = [...updatedMessages, assistantMessage];
          setMessages(finalMessages);
          updatePaperState(paper.paper.id, { messages: finalMessages });
        } catch (error) {
          console.error('Error in chat:', error);
          const errorMessage: Message = {
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.'
          };
          const errorMessages = [...updatedMessages, errorMessage];
          setMessages(errorMessages);
          updatePaperState(paper.paper.id, { messages: errorMessages });
        } finally {
          setIsChatLoading(false);
        }
      }
    }
  };

  const fetchPdfContent = async (selectedIndex: number) => {
    // Skip if not discussion tab or if we already have messages
    if (selectedIndex !== 2 || messages.length > 0) return;

    // Skip if we already have PDF content
    if (!pdfContent) {
      setIsLoading(true);
      setStatus('Attempting to retrieve paper content...');

      try {
        const apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY;

        if (!apiKey) {
          console.warn('Firecrawl API key is not set. Please add it to your .env file.');
          const errorMessage = "PDF content could not be loaded. The Firecrawl API key is missing.";
          setPdfContent(errorMessage);
          updatePaperState(paper.paper.id, { pdfContent: errorMessage });
          setIsLoading(false);
          setStatus('Failed to retrieve paper content due to missing API key.');
          return;
        }

        const response = await axios.post(
          'https://api.firecrawl.dev/v1/scrape',
          {
            url: `https://arxiv.org/html/${paper.paper.id}`,
            formats: ['markdown']
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: 30000
          }
        );

        if (response.data.success) {
          const newPdfContent = response.data.data.markdown;
          setPdfContent(newPdfContent);
          updatePaperState(paper.paper.id, { pdfContent: newPdfContent });
        }
      } catch (error) {
        console.error('Error fetching PDF content:', error);
        const errorMessage = "Error loading PDF content. Please try again later.";
        setPdfContent(errorMessage);
        updatePaperState(paper.paper.id, { pdfContent: errorMessage });
        setStatus('Failed to retrieve paper content.');
      } finally {
        setIsLoading(false);
        if (pdfContent && !pdfContent.includes("Error") && !pdfContent.includes("missing")) {
          setStatus('Generating summary with Gemini...');
          generatePaperSummary();
        }
      }
    } else {
      // If we have PDF content but no messages, generate summary
      if (messages.length === 0 && !pdfContent.includes("Error") && !pdfContent.includes("missing")) {
        setStatus('Generating summary with Gemini...');
        generatePaperSummary();
      }
    }
  };

  const generatePaperSummary = async () => {
    if (summary || messages.length > 0) return;

    setIsSummarizing(true);
    try {
      const result = await generateSummary(
        paper.title,
        paper.paper.summary,
        pdfContent
      );
      setSummary(result.summary);
      const newMessages: Message[] = [
        { role: 'assistant', content: result.summary },
        {
          role: 'suggestions',
          content: '### Here are some questions you might want to ask:',
          questions: result.questions
        }
      ];
      setMessages(newMessages);
      updatePaperState(paper.paper.id, { messages: newMessages });
    } catch (error) {
      console.error('Error generating summary:', error);
      const errorMessages: Message[] = [{
        role: 'assistant',
        content: 'I encountered an error generating the summary. Please feel free to ask questions about the paper.'
      }];
      setMessages(errorMessages);
      updatePaperState(paper.paper.id, { messages: errorMessages });
    } finally {
      setIsSummarizing(false);
      setStatus('');
    }
  };

  const handleQuestionClick = (question: string) => {
    setNewMessage(question);
  };

  const handleGenerateObsidianNote = async () => {
    setIsGeneratingNote(true);
    try {
      // If we don't have PDF content yet, try to fetch it first
      if (!pdfContent) {
        setStatus('Fetching paper content...');
        try {
          const apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY;

          if (!apiKey) {
            console.warn('Firecrawl API key is not set. Please add it to your .env file.');
            const errorMessage = "PDF content could not be loaded. The Firecrawl API key is missing.";
            setPdfContent(errorMessage);
            updatePaperState(paper.paper.id, { pdfContent: errorMessage });
            setStatus('Failed to retrieve paper content due to missing API key.');
            setIsGeneratingNote(false);
            return;
          }

          const response = await axios.post(
            'https://api.firecrawl.dev/v1/scrape',
            {
              url: `https://arxiv.org/html/${paper.paper.id}`,
              formats: ['markdown']
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              timeout: 30000
            }
          );

          if (response.data.success) {
            const newPdfContent = response.data.data.markdown;
            setPdfContent(newPdfContent);
            updatePaperState(paper.paper.id, { pdfContent: newPdfContent });

            // Generate note with the fetched content
            const note = await generateObsidianNote(paper.paper, newPdfContent);
            setNotes(note);
            updatePaperState(paper.paper.id, { notes: note });
          } else {
            // If fetching fails, generate note with empty content
            const note = await generateObsidianNote(paper.paper, '');
            setNotes(note);
            updatePaperState(paper.paper.id, { notes: note });
          }
        } catch (error) {
          console.error('Error fetching PDF content:', error);
          // If fetching fails, generate note with empty content
          const note = await generateObsidianNote(paper.paper, '');
          setNotes(note);
          updatePaperState(paper.paper.id, { notes: note });
        }
      } else {
        // If we already have PDF content, use it
        const note = await generateObsidianNote(paper.paper, pdfContent);
        setNotes(note);
        updatePaperState(paper.paper.id, { notes: note });
      }
    } catch (error) {
      console.error('Error generating Obsidian note:', error);
    } finally {
      setIsGeneratingNote(false);
      setStatus('');
    }
  };

  const handleDownloadNote = () => {
    if (!notes) return;

    const blob = new Blob([notes], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paper.paper.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyNote = async () => {
    if (!notes) return;

    try {
      await navigator.clipboard.writeText(notes);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-4xl h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-xl flex flex-col">
          <Tab.Group as="div" className="flex flex-col h-full" onChange={fetchPdfContent}>
            <div className="flex-none bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
              <div className="p-4 sm:p-6 rounded-t-2xl bg-white/50 dark:bg-gray-900/50">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 pr-12">
                  {paper.title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Published on {new Date(paper.publishedAt).toLocaleDateString()}
                </p>
              </div>

              <Tab.List className="flex overflow-x-auto px-4 sm:px-6 hide-scrollbar">
                {tabs.map((tab) => (
                  <Tab
                    key={tab.name}
                    className={({ selected }) =>
                      `flex items-center shrink-0 space-x-2 px-3 sm:px-4 py-3 text-sm font-medium focus:outline-none border-b-2 ${selected
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      }`
                    }
                  >
                    <tab.icon className="w-5 h-5" />
                    <span className="hidden sm:inline">{tab.name}</span>
                  </Tab>
                ))}
              </Tab.List>

              <button
                onClick={onClose}
                className="absolute right-4 top-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-30"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <Tab.Panels className="flex-1 overflow-y-auto p-4 sm:p-6">
              <Tab.Panel className="h-full">
                <div className="space-y-6">
                  <div className="aspect-video w-full relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img
                      src={paper.thumbnail}
                      alt={paper.title}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {paper.paper.summary}
                  </p>
                </div>
              </Tab.Panel>

              <Tab.Panel className="h-full">
                <div className="space-y-4">
                  <a
                    href={`https://arxiv.org/abs/${paper.paper.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors w-full"
                  >
                    <ArrowTopRightOnSquareIcon className="w-5 h-5 mr-2" />
                    <span>View on arXiv</span>
                  </a>
                  <a
                    href={`https://arxiv.org/pdf/${paper.paper.id}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors w-full"
                  >
                    <ArrowTopRightOnSquareIcon className="w-5 h-5 mr-2" />
                    <span>Download PDF</span>
                  </a>
                  <a
                    href={`https://huggingface.co/papers/${paper.paper.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors w-full"
                  >
                    <ArrowTopRightOnSquareIcon className="w-5 h-5 mr-2" />
                    <span>View on Hugging Face</span>
                  </a>
                </div>
              </Tab.Panel>

              <Tab.Panel className="h-full">
                <div className="flex flex-col h-full">
                  <div
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto space-y-4 mb-4"
                  >
                    {(isLoading || isSummarizing) ? (
                      <div className="flex flex-col items-center justify-center p-8 space-y-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        {status && (
                          <p className="text-blue-600 dark:text-blue-400 text-center font-medium">
                            {status}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {messages.map((message, index) => (
                          <div
                            key={index}
                            className="flex justify-start"
                          >
                            <div
                              className={`max-w-[95%] sm:max-w-[80%] rounded-lg p-4 ${message.role === 'user'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 ml-auto'
                                : message.role === 'suggestions'
                                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100 prose dark:prose-invert'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 prose dark:prose-invert'
                                }`}
                            >
                              {message.role === 'suggestions' ? (
                                <div className="space-y-4">
                                  <ReactMarkdown>{message.content}</ReactMarkdown>
                                  <div className="flex flex-col gap-2">
                                    {message.questions?.map((question, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => handleQuestionClick(question)}
                                        className="text-left px-4 py-2 text-sm bg-white/50 dark:bg-gray-800/50 rounded-lg hover:bg-white/80 dark:hover:bg-gray-700/80 transition-colors"
                                      >
                                        {question}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="prose dark:prose-invert max-w-none">
                                  <ReactMarkdown
                                    className="text-justify sm:text-left [&>p]:text-base [&>p]:leading-relaxed [&>h1]:text-xl [&>h2]:text-lg [&>h3]:text-base [&>blockquote]:text-sm [&>blockquote]:italic [&>ul]:text-base [&>ol]:text-base"
                                  >
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {isChatLoading && (
                          <div className="flex justify-start">
                            <div className="max-w-[95%] sm:max-w-[80%] rounded-lg p-4 bg-blue-100 dark:bg-blue-900/30">
                              <div className="animate-pulse flex space-x-2">
                                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mt-auto bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-2 sm:p-0 -mx-4 sm:mx-0">
                    <div className="flex-1 relative mx-2 sm:mx-0">
                      <textarea
                        ref={textareaRef}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Ask a question about the paper..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-base sm:text-sm"
                        style={{
                          minHeight: '44px',
                          maxHeight: '120px'
                        }}
                      />
                      <div className="absolute right-3 bottom-3 flex items-center gap-2">
                        <span className="text-xs text-gray-400 hidden sm:inline">
                          Press Enter to send
                        </span>
                        <button
                          onClick={() => {
                            if (newMessage.trim() && !isChatLoading) {
                              const event = {
                                key: 'Enter',
                                shiftKey: false,
                                preventDefault: () => { }
                              } as React.KeyboardEvent<HTMLTextAreaElement>;
                              handleKeyPress(event);
                            }
                          }}
                          disabled={!newMessage.trim() || isChatLoading}
                          className="p-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:hidden"
                        >
                          <PaperAirplaneIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="px-2 sm:px-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                        Shift + Enter for new line
                      </p>
                    </div>
                  </div>
                </div>
              </Tab.Panel>

              <Tab.Panel className="h-full">
                <div className="flex flex-col h-full gap-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleGenerateObsidianNote}
                      disabled={isGeneratingNote}
                      className="flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingNote ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <PencilSquareIcon className="w-5 h-5 mr-2" />
                          <span>Generate Obsidian Note</span>
                        </>
                      )}
                    </button>
                    {notes && (
                      <>
                        <button
                          onClick={handleDownloadNote}
                          className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                          <span>Download Note</span>
                        </button>
                        <button
                          onClick={handleCopyNote}
                          className="flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          {isCopied ? (
                            <>
                              <ClipboardDocumentCheckIcon className="w-5 h-5 mr-2" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <ClipboardDocumentIcon className="w-5 h-5 mr-2" />
                              <span>Copy Note</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex-1 relative">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Generate an Obsidian note or take your own notes about this paper..."
                      className="w-full h-full p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
                    />
                  </div>
                </div>
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};