import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ChatPanel.css';
import { formatMessageTimestamp } from '../utils/chatDeduplication';

export interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
  type: 'text' | 'system';
}

interface ChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  userId: string;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onToggle,
  userId,
  messages,
  onSendMessage
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const messageText = inputValue.trim();
    setInputValue('');
    onSendMessage(messageText);
  }, [inputValue, onSendMessage]);

  return (
    <>
      {!isOpen && (
        <button className="chat-toggle-button" onClick={onToggle} title="打开聊天" aria-label="打开聊天">
          💬
        </button>
      )}

      {isOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-title">聊天</span>
            <button className="chat-close-button" onClick={onToggle} title="关闭聊天" aria-label="关闭聊天">
              ×
            </button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">暂无消息</div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.sender === userId ? 'chat-message-own' : ''}`}
                >
                  <div className="chat-message-header">
                    <span className="chat-message-sender">
                      {msg.sender === userId ? '我' : msg.sender}
                    </span>
                    <span className="chat-message-time">{formatMessageTimestamp(msg.timestamp)}</span>
                  </div>
                  <div className="chat-message-content">{msg.message}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="chat-input"
              placeholder="输入消息..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
            />
            <button type="submit" className="chat-send-button" disabled={!inputValue.trim()}>
              发送
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatPanel;
