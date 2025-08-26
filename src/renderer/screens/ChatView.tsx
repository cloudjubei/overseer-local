import React from 'react';

const ChatView = () => {
  return (
    <div className="flex flex-col h-full">
      <h1 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-neutral-100">Project Chat</h1>
      <div
        className="flex-1 overflow-y-auto mb-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 rounded-md"
        id="message-list"
      >
        {/* Message list will be populated here */}
      </div>
      <div className="flex">
        <textarea
          className="flex-1 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 rounded-md text-neutral-900 dark:text-neutral-100"
          placeholder="Type your message..."
          rows={3}
        ></textarea>
        <button className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatView;
