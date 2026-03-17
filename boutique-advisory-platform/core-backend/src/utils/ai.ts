import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_key");

/**
 * Deal Analysis AI
 */
export const ai = {
    /**
     * Generate a professional deal summary for investors
     */
    async generateDealSummary(dealData: any) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const prompt = `
                You are a professional investment analyst. 
                Based on the following SME and Deal data, generate a concise, professional executive summary for potential investors.
                Highlight key value propositions, market opportunity, and funding usage.
                
                Data:
                SME: ${JSON.stringify(dealData.sme)}
                Deal: ${JSON.stringify(dealData.deal)}
                
                Format as valid Markdown. Max 500 words.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini AI Error (Summary):', error);
            return "AI Summary is currently unavailable. Please review the deal details manually.";
        }
    },

    /**
     * Risk analysis of a deal
     */
    async analyzeDealRisks(dealData: any) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const prompt = `
                Analyze the potential risks of the following investment deal.
                Be objective and think like a venture capitalist or private equity investor.
                Identify 3-5 key risks and suggest mitigation strategies.
                
                Data:
                SME: ${JSON.stringify(dealData.sme)}
                Deal: ${JSON.stringify(dealData.deal)}
                
                Format as a JSON object with a 'risks' array containing {title, description, mitigation}.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Extract JSON if AI surrounds it with markdown backticks
            const jsonStr = text.replace(/```json|```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('Gemini AI Error (Risk):', error);
            return { risks: [] };
        }
    },

    /**
     * Chat with Dataroom (RAG - basic implementation for now)
     */
    async chatWithDataroom(query: string, documents: any[]) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const docContext = documents.map(d => `${d.name}: ${d.type}`).join(', ');

            const prompt = `
                You are an AI Assistant for a Boutique Advisory Data Room.
                An investor is asking a question about the documents available.
                
                Available Documents: ${docContext}
                Question: "${query}"
                
                Provide a helpful answer based on the context. If you don't know the exact details from the file content (since you can only see the name/type here), explain what's available and what they should look for.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini AI Error (Chat):', error);
            return "I'm having trouble connecting to my knowledge base. Please try again later.";
        }
    }
};
