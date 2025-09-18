"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Send, ArrowLeft, MoreVertical, Star, Edit, List } from "lucide-react"

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  timestamp: Date
}

interface Option {
  id: string
  label: string
  description: string
  difficulty: "Easy" | "Medium" | "Ambitious" | "Refine" | "Select"
}

export function ChatInterface() {
  const [messages] = useState<Message[]>([
    {
      id: "1",
      type: "user",
      content: "I want to improve my sleep",
      timestamp: new Date("2024-01-15T14:30:00"),
    },
    {
      id: "2",
      type: "assistant",
      content: "Great! Improving your sleep is a great goal, here are some options:",
      timestamp: new Date("2024-01-15T14:30:05"),
    },
  ])

  const [options] = useState<Option[]>([
    {
      id: "1",
      label: "Easy",
      description: "For 5 days - You should try going to bed before midnight.",
      difficulty: "Easy",
    },
    {
      id: "2",
      label: "Medium",
      description: "For a week - you should try getting at least 7 hours of sleep.",
      difficulty: "Medium",
    },
    {
      id: "3",
      label: "Ambitious",
      description: "For 2 weeks - Go to bed before midnight and get 8 hours of sleep.",
      difficulty: "Ambitious",
    },
    {
      id: "4",
      label: "Refine",
      description: "Want to edit your goal?",
      difficulty: "Refine",
    },
    {
      id: "5",
      label: "Select",
      description: "Pick one of the most common sleep goals.",
      difficulty: "Select",
    },
  ])

  const [inputValue, setInputValue] = useState("")

  const handleOptionClick = (option: Option) => {
    console.log("Selected option:", option)
  }

  const renderDifficultyStars = (difficulty: string) => {
    const starCount = difficulty === "Easy" ? 1 : difficulty === "Medium" ? 2 : difficulty === "Ambitious" ? 3 : 0
    if (starCount === 0) return null

    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: starCount }).map((_, i) => (
          <Star key={i} className="h-3 w-3 fill-current" />
        ))}
      </div>
    )
  }

  const renderActionIcon = (difficulty: string) => {
    if (difficulty === "Refine") {
      return <Edit className="h-4 w-4" />
    }
    if (difficulty === "Select") {
      return <List className="h-4 w-4" />
    }
    return null
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-900/30 text-green-100 border-green-600/50 hover:bg-green-900/40"
      case "Medium":
        return "bg-yellow-900/30 text-yellow-100 border-yellow-600/50 hover:bg-yellow-900/40"
      case "Ambitious":
        return "bg-red-900/30 text-red-100 border-red-600/50 hover:bg-red-900/40"
      case "Refine":
        return "bg-blue-900/30 text-blue-100 border-blue-600/50 hover:bg-blue-900/40"
      case "Select":
        return "bg-purple-900/30 text-purple-100 border-purple-600/50 hover:bg-purple-900/40"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-background">
      <div className="flex items-center justify-between p-4 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold text-sm">AI</span>
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Compass</h1>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-foreground">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.type === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card text-card-foreground rounded-bl-md"
              }`}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        <div className="space-y-2 mt-4">
          {options.slice(0, 3).map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className={`w-full justify-between text-left h-auto p-3 ${getDifficultyColor(option.difficulty)} transition-all duration-200`}
              onClick={() => handleOptionClick(option)}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0">{renderDifficultyStars(option.difficulty)}</div>
                <span className="text-sm font-medium text-balance leading-relaxed">{option.description}</span>
              </div>
              {renderActionIcon(option.difficulty)}
            </Button>
          ))}

          <div className="flex items-center justify-center py-3">
            <span className="text-xs text-muted-foreground">--- Not the goals you looked for? ---</span>
          </div>

          {options.slice(3).map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className={`w-full justify-between text-left h-auto p-3 ${getDifficultyColor(option.difficulty)} transition-all duration-200`}
              onClick={() => handleOptionClick(option)}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0">{renderDifficultyStars(option.difficulty)}</div>
                <span className="text-sm font-medium text-balance leading-relaxed">{option.description}</span>
              </div>
              {renderActionIcon(option.difficulty)}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4 bg-card border-t border-border">
        <div className="flex items-center gap-2 bg-background rounded-full px-4 py-2 border border-border">
          <input
            type="text"
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          <Button
            size="icon"
            className="rounded-full h-8 w-8 bg-primary hover:bg-primary/90"
            disabled={!inputValue.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
