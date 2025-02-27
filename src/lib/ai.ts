import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Rate limiting configuration
const rateLimitConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 8000,  // 8 seconds
};

// Helper function for exponential backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  retryCount = 0
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (error?.status === 429 && retryCount < rateLimitConfig.maxRetries) {
      const delay = Math.min(
        rateLimitConfig.baseDelay * Math.pow(2, retryCount),
        rateLimitConfig.maxDelay
      );
      await sleep(delay);
      return retryWithBackoff(operation, retryCount + 1);
    }
    throw error;
  }
};

export interface SummaryResponse {
  summary: string;
  questions: string[];
}

export const generateSummary = async (title: string, abstract: string, content: string = ""): Promise<SummaryResponse> => {
  const prompt = `
    As an expert research assistant, analyze this academic paper and provide a detailed review. Your analysis should include:

    1. A comprehensive summary (2-3 sentences)
    2. Analysis of novelty and impact
    3. Three thought-provoking questions about the paper

    Format your response using markdown with the following structure:

    ## Summary
    [Provide a clear explanation of the paper's main objective, key methodology, and primary results/conclusions]

    ## Innovation & Impact
    ### Technical Contribution
    [Identify and explain the main technical innovation or novel contribution]

    ### Field Significance
    [Explain why this work is significant for the field]

    ### Real-world Applications
    [Highlight potential practical applications and impact]

    ## Questions
    1. [First complete question about methodology or approach]
    2. [Second complete question about results or implications]
    3. [Third complete question about future work or extensions]

    Here's the paper:
    Title: ${title}
    Abstract: ${abstract}
    Content: ${content}

    IMPORTANT: 
    1. Use proper markdown formatting including:
      - Headers (##, ###)
      - Lists (- or 1.)
      - Bold (**) for emphasis
      - Code blocks (\`\`) for technical terms
      - Blockquotes (>) for important quotes
    2. Make sure the questions section is clearly separated and each question is on a new line starting with a number
    3. Questions MUST be thought-provoking and specific to the paper's content
    4. If the content is blank, specify "BASED ON ABSTRACT ONLY" at the start
  `;

  try {
    const result = await retryWithBackoff(() => model.generateContent(prompt));
    const text = result.response.text();
    
    // Extract questions from the response
    const questionsMatch = text.match(/## Questions\n((?:[\d]+\. [^\n]+\n?)+)/);
    const questions = questionsMatch 
      ? questionsMatch[1]
        .split('\n')
        .filter(q => q.match(/^\d+\. /))
        .map(q => q.replace(/^\d+\. /, '').trim())
      : [];

    // Remove the Questions section from the summary
    const summary = text.replace(/## Questions[\s\S]*$/, '').trim();

    return {
      summary,
      questions
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
};

export const chat = async (
  title: string,
  abstract: string,
  content: string = "",
  question: string
) => {
  const prompt = `You are an expert research assistant specializing in academic paper analysis. Your task is to answer questions about the paper using a clear, academic style with proper citations.

Paper Title: ${title}
Abstract: ${abstract}
${content ? `Content: ${content}` : ""}

Question: ${question}

Guidelines for your response:
1. Use Markdown formatting for better readability
2. Structure your answer with clear sections when appropriate
3. Always cite specific parts of the paper using quotes and section references
4. If information isn't available in the paper, clearly state this
5. Keep responses concise but thorough
6. Use bullet points or numbered lists for multiple points
7. Format quotes from the paper like this: "> [quote]"

Example format:

Based on the paper's [section/content], [your analysis...]

> "[relevant quote from paper]"

This demonstrates [explanation...]

Key points:
• [point 1]
• [point 2]
Response always in markdown format.`;

  try {
    const result = await retryWithBackoff(() => model.generateContent(prompt));
    return result.response.text();
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw error;
  }
};

export const generateObsidianNote = async (
  paper: {
    id: string;
    title: string;
    authors: Array<{ name: string; user?: { fullname: string } }>;
    publishedAt: string;
    summary: string;
  },
  content: string = ""
) => {
  const template = `---
id: ${paper.id}
created_date: ${new Date().toISOString().split('T')[0]}
updated_date: ${new Date().toISOString().split('T')[0]}
type: note
---

# ${paper.title}

## 🏷️ Tags
#${new Date().toLocaleString('default', { month: '2-digit' })}-${new Date().getFullYear()} [Additional tags will be added based on content]

## 📝 Notes
[Your analysis will go here]

## 🔗 Links
- **Authors**: ${paper.authors.map(author => author.user?.fullname || author.name).join(', ')}
- **Published**: ${new Date(paper.publishedAt).toLocaleDateString()}
- **arXiv**: [View Paper](https://arxiv.org/abs/${paper.id})
- **PDF**: [Download PDF](https://arxiv.org/pdf/${paper.id}.pdf)`;

  const prompt = `As an expert research assistant, create a comprehensive research note about this academic paper. 

Here's the paper information:
Title: ${paper.title}
Abstract: ${paper.summary}
${content ? `Content: ${content}` : ""}

CRITICAL: Your response MUST follow this EXACT format:

${template}

Guidelines for your analysis in the Notes section:
1. Start with "Based on ${content ? 'the full paper' : 'the abstract'}"
2. Include these subsections with bullet points:
   - **Key Objectives**
   - **Methodology**
   - **Main Findings**
   - **Technical Contributions**
   - **Practical Applications**
3. Add relevant technical tags after the date tag (e.g., #NLP, #CV, #ML, #transformers)
4. Keep the exact template structure with all sections
5. Preserve all links exactly as shown
6. Use proper markdown formatting

IMPORTANT: 
- DO NOT modify the template structure
- DO NOT change the Links section
- DO NOT remove any existing content
- ALWAYS keep the frontmatter (---)
- ALWAYS include all sections`;

  try {
    const result = await retryWithBackoff(() => model.generateContent(prompt));
    let note = result.response.text();
    
    // Validate and fix the note structure if needed
    if (!note.startsWith('---')) {
      note = template;
    }
    
    // Ensure the Links section exists and is correct
    const linksSection = `## 🔗 Links
- **Authors**: ${paper.authors.map(author => author.user?.fullname || author.name).join(', ')}
- **Published**: ${new Date(paper.publishedAt).toLocaleDateString()}
- **arXiv**: [View Paper](https://arxiv.org/abs/${paper.id})
- **PDF**: [Download PDF](https://arxiv.org/pdf/${paper.id}.pdf)`;

    if (!note.includes('## 🔗 Links')) {
      note += '\n\n' + linksSection;
    }

    return note;
  } catch (error) {
    console.error('Error generating Obsidian note:', error);
    // Return the basic template if there's an error
    return template;
  }
};