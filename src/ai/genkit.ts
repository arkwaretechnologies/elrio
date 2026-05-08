import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';

config({path: `.env`});

if (!process.env.GEMINI_API_KEY) {
  throw new Error(
    'Please set the GEMINI_API_KEY environment variable in your .env file.'
  );
}

export const ai = genkit({
  plugins: [googleAI({apiKey: process.env.GEMINI_API_KEY as string})],
});
