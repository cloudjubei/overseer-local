import React, { useState } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <div className="flex flex-col h-full p-4 bg-gray-100">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            Start chatting about the project
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'}`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatView;
