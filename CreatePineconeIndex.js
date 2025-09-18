// Done just once (stored persistently in cloud)

import { Pinecone } from '@pinecone-database/pinecone';

export const pineconeClient = new Pinecone({
  apiKey: '' //key here
});

// Name of your index
export const INDEX_NAME = 'discord-bot-code';

await pineconeClient.createIndexForModel({
    name: INDEX_NAME,
    cloud: 'aws',
    region: 'us-east-1',
    embed: {
      model: 'llama-text-embed-v2', // Pinecone’s integrated embedding model
      fieldMap: { text: 'chunk_text' },
    },
    waitUntilReady: true,
  });