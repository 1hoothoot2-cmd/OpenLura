export default function Home() {
  return (
    <main className="flex flex-col h-screen bg-black text-white">
      
      {/* Chat messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        
        <div className="bg-gray-800 p-3 rounded-xl w-fit max-w-xs">
          👋 Welcome to Lura AI
        </div>

        <div className="bg-gray-700 p-3 rounded-xl w-fit max-w-xs ml-auto">
          Hello!
        </div>

      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 flex gap-2">
        <input 
          className="flex-1 p-3 rounded-xl bg-gray-900 outline-none"
          placeholder="Type your message..."
        />
        <button className="bg-white text-black px-4 rounded-xl">
          Send
        </button>
      </div>

    </main>
  );
}export default function Home() {
  return (
    <main className="flex flex-col h-screen bg-black text-white">
      
      {/* Chat messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        
        <div className="bg-gray-800 p-3 rounded-xl w-fit max-w-xs">
          👋 Welcome to Lura AI
        </div>

        <div className="bg-gray-700 p-3 rounded-xl w-fit max-w-xs ml-auto">
          Hello!
        </div>

      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 flex gap-2">
        <input 
          className="flex-1 p-3 rounded-xl bg-gray-900 outline-none"
          placeholder="Type your message..."
        />
        <button className="bg-white text-black px-4 rounded-xl">
          Send
        </button>
      </div>

    </main>
  );
}